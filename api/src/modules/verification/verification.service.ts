import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { extname } from 'path';
import { Repository } from 'typeorm';
import {
  DocumentType,
  VerificationStatus,
} from '../../common/enums';
import { StorageService } from '../storage/storage.service';
import { VerificationRecord } from './entities/verification-record.entity';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(VerificationRecord)
    private readonly records: Repository<VerificationRecord>,
    private readonly storage: StorageService,
  ) {}

  // Driver uploads a document (API-mediated → private Storage bucket → DB row).
  async submit(
    driverId: string,
    documentType: DocumentType,
    file: Express.Multer.File,
  ): Promise<VerificationRecord> {
    if (!file) throw new BadRequestException('A document file is required');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG or PDF documents are allowed');
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
  ): Promise<VerificationRecord> {
    const record = await this.records.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Verification record not found');
    if (record.status !== VerificationStatus.PENDING) {
      throw new ForbiddenException('Record has already been reviewed');
    }
    record.status = status;
    record.reviewedBy = adminId;
    record.reviewedAt = new Date();
    return this.records.save(record);
  }
}
