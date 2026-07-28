import { createHmac } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UserRole } from '../../common/enums';
import { StorageService } from '../storage/storage.service';

export interface DeletionResult {
  filesPurged: number;
  blocklisted: boolean;
}

// Orchestrates full account erasure. The DB row is the system of record, so the
// user DELETE (which cascades to jobs, proposals, messages, ratings, tokens,
// notifications; nulls payments and audit-log actor) is the authoritative step
// and runs inside a transaction. Verification document FILES live in Storage, so
// they are purged separately (best-effort — a Storage hiccup must not strand the
// erasure). Payments are financial records: they survive with their user link
// nulled by the FK, and this service also nulls their raw_webhook_payload, which
// can carry provider-side PII.
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger('AccountDeletion');
  private readonly hashKey: string;

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    // Reuse the JWT access secret as the HMAC key so a blocklist hash is
    // deterministic (registration can re-derive it) but the raw email/phone is
    // never recoverable from the stored value.
    this.hashKey = config.get<string>('jwt.accessSecret') ?? '';
  }

  hashIdentifier(value: string): string {
    return createHmac('sha256', this.hashKey)
      .update(value.trim().toLowerCase())
      .digest('hex');
  }

  async isBlocklisted(email: string, phone: string): Promise<boolean> {
    const [row] = await this.ds.query(
      `SELECT 1 FROM account_blocklist
       WHERE email_hash = $1 OR phone_hash = $2 LIMIT 1`,
      [this.hashIdentifier(email), this.hashIdentifier(phone)],
    );
    return !!row;
  }

  // Delete a user's account. When [blocklistReason] is set (admin removal for
  // fraud), a hashed record of the email/phone is retained to block immediate
  // re-registration.
  async deleteUser(
    userId: string,
    opts: { blocklistReason?: string } = {},
  ): Promise<DeletionResult> {
    const [user] = await this.ds.query(
      `SELECT id, email, phone, role FROM users WHERE id = $1`,
      [userId],
    );
    if (!user) throw new NotFoundException('User not found');

    // Never delete the last remaining admin — that would lock everyone out of
    // the admin console with no recovery path.
    if (user.role === UserRole.ADMIN) {
      const [{ count }] = await this.ds.query(
        `SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'`,
      );
      if (count <= 1) {
        throw new ForbiddenException('Cannot delete the last admin account.');
      }
    }

    // Purge verification documents from Storage first. Prefix matches the upload
    // path `verification/{driverId}/...`. Best-effort, returns count.
    const filesPurged = await this.storage.deleteByPrefix(
      `verification/${userId}/`,
    );

    let blocklisted = false;
    await this.ds.transaction(async (manager) => {
      // Scrub provider payloads on this user's payments before the FK nulls the
      // link — the payload can hold PII we are not retaining.
      await manager.query(
        `UPDATE payments SET raw_webhook_payload = NULL
         WHERE payer_id = $1 OR payee_id = $1`,
        [userId],
      );

      if (opts.blocklistReason) {
        await manager.query(
          `INSERT INTO account_blocklist (email_hash, phone_hash, reason)
           VALUES ($1, $2, $3)`,
          [
            this.hashIdentifier(user.email),
            this.hashIdentifier(user.phone),
            opts.blocklistReason,
          ],
        );
        blocklisted = true;
      }

      // The cascade does the rest (jobs, proposals, messages, ratings, tokens,
      // notifications, message_reads, vehicles; payments payer/payee -> NULL;
      // audit_logs actor -> NULL).
      await manager.query(`DELETE FROM users WHERE id = $1`, [userId]);
    });

    this.logger.log(
      `Account ${userId} deleted (files purged: ${filesPurged}, blocklisted: ${blocklisted})`,
    );
    return { filesPurged, blocklisted };
  }
}
