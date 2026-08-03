import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { extname } from 'path';
import { Repository } from 'typeorm';
import { DocumentType, VerificationStatus } from '../../common/enums';
import { MAIL_SERVICE, MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { VerificationRecord } from './entities/verification-record.entity';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  [DocumentType.LICENCE]: 'Driving licence',
  [DocumentType.NATIONAL_ID]: 'National ID',
  [DocumentType.VEHICLE_REG]: 'Vehicle registration',
};

@Injectable()
export class VerificationService {
  private readonly logger = new Logger('Verification');

  constructor(
    @InjectRepository(VerificationRecord)
    private readonly records: Repository<VerificationRecord>,
    private readonly storage: StorageService,
    private readonly push: PushService,
    @Inject(MAIL_SERVICE) private readonly mail: MailService,
    private readonly users: UsersService,
  ) {}

  // Driver uploads a document (API-mediated → private Storage bucket → DB row).
  async submit(
    driverId: string,
    documentType: DocumentType,
    file: Express.Multer.File,
  ): Promise<VerificationRecord> {
    if (!file) throw new BadRequestException('A document file is required');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG or PDF documents are allowed',
      );
    }
    const objectPath = `verification/${driverId}/${documentType}-${Date.now()}${extname(
      file.originalname,
    )}`;
    const { storageReference } = await this.storage.upload(
      objectPath,
      file.buffer,
      file.mimetype,
    );
    const record = this.records.create({
      driverId,
      documentType,
      storageReference,
      status: VerificationStatus.PENDING,
    });
    return this.records.save(record);
  }

  listOwn(driverId: string): Promise<VerificationRecord[]> {
    return this.records.find({
      where: { driverId },
      order: { createdAt: 'DESC' },
    });
  }

  async getRecord(id: string): Promise<VerificationRecord> {
    const record = await this.records.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Verification record not found');
    return record;
  }

  // A driver may only fetch a short-lived view URL for their OWN documents.
  async ownDocumentUrl(
    driverId: string,
    recordId: string,
  ): Promise<{ url: string | null; stub: boolean }> {
    const record = await this.records.findOne({ where: { id: recordId } });
    if (!record || record.driverId !== driverId) {
      throw new NotFoundException('Verification record not found');
    }
    return this.storage.signedUrl(record.storageReference);
  }

  // ---- admin side ----
  listByStatus(status?: VerificationStatus): Promise<VerificationRecord[]> {
    return this.records.find({
      where: status ? { status } : {},
      order: { createdAt: 'ASC' },
    });
  }

  async review(
    id: string,
    status: VerificationStatus.APPROVED | VerificationStatus.REJECTED,
    adminId: string,
    reviewNote?: string,
  ): Promise<VerificationRecord> {
    const record = await this.records.findOne({
      where: { id },
      relations: { driver: true },
    });
    if (!record) throw new NotFoundException('Verification record not found');
    if (record.status !== VerificationStatus.PENDING) {
      throw new ForbiddenException('Record has already been reviewed');
    }
    record.status = status;
    record.reviewedBy = adminId;
    record.reviewedAt = new Date();
    record.reviewNote =
      status === VerificationStatus.REJECTED ? (reviewNote ?? null) : null;
    const saved = await this.records.save(record);

    const label = DOCUMENT_LABELS[record.documentType];

    // Notify the driver on rejection so they can fix + resubmit. Best-effort:
    // a mail failure must not fail the admin's review action.
    if (status === VerificationStatus.REJECTED && record.driver) {
      try {
        await this.mail.sendVerificationRejected(
          record.driver.email,
          record.driver.name,
          label,
          saved.reviewNote,
        );
      } catch (err) {
        this.logger.error(
          'Rejection email delivery failed (continuing)',
          err as Error,
        );
      }
    }

    // Push the decision to the driver's device (best-effort — never throws).
    if (status === VerificationStatus.REJECTED) {
      void this.push.sendToUser(record.driverId, {
        title: 'Document not approved',
        body: `Your ${label} needs re-uploading${
          saved.reviewNote ? `: ${saved.reviewNote}` : '.'
        }`,
        data: { type: 'verification_rejected', documentType: record.documentType },
      });
    } else {
      // If THIS approval completes the driver's verification, nudge them to go
      // online — we deliberately do NOT auto-set them online. Matching requires a
      // stored location, which only the device can supply when the driver goes
      // online from the app; setting status=online here without a location would
      // show an ONLINE badge while leaving the driver invisible to owners. So
      // "online" is only ever set by the driver's own go-online action (which
      // captures GPS), keeping "online = genuinely available and locatable".
      const nowFullyVerified = await this.isFullyVerified(record.driverId);
      void this.push.sendToUser(record.driverId, {
        title: nowFullyVerified ? "You're verified" : 'Document approved',
        body: nowFullyVerified
          ? `Your ${label} was approved. You're fully verified — go online in the app to start receiving jobs.`
          : `Your ${label} was approved.`,
        data: { type: 'verification_approved', documentType: record.documentType },
      });
    }
    return saved;
  }

  // True once the driver has all three required documents approved — the same
  // rule the matching query and go-online guard use.
  private async isFullyVerified(driverId: string): Promise<boolean> {
    const rows = await this.records
      .createQueryBuilder('r')
      .select('COUNT(DISTINCT r.documentType)', 'count')
      .where('r.driverId = :driverId', { driverId })
      .andWhere('r.status = :status', {
        status: VerificationStatus.APPROVED,
      })
      .andWhere('r.documentType IN (:...types)', {
        types: [
          DocumentType.LICENCE,
          DocumentType.NATIONAL_ID,
          DocumentType.VEHICLE_REG,
        ],
      })
      .getRawOne<{ count: string }>();
    return Number(rows?.count ?? 0) === 3;
  }

  // Admin action: re-open an already-decided record back to PENDING so it can be
  // reviewed again (e.g. revoke an approval, or reconsider a rejection).
  async reopen(id: string): Promise<VerificationRecord> {
    const record = await this.records.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Verification record not found');
    if (record.status === VerificationStatus.PENDING) {
      throw new ForbiddenException('Record is already pending review.');
    }
    record.status = VerificationStatus.PENDING;
    record.reviewedBy = null;
    record.reviewedAt = null;
    record.reviewNote = null;
    return this.records.save(record);
  }
}
