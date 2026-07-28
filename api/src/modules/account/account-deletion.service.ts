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

      // Counterparties this user rated. Their ratings survive with from_user_id
      // nulled (SET NULL), so their stored average is unaffected by the delete;
      // but capture them now so we can recompute below in case scores shift.
      const ratedRows: { to_user_id: string }[] = await manager.query(
        `SELECT DISTINCT to_user_id FROM ratings
         WHERE from_user_id = $1 AND to_user_id <> $1`,
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

      // Cascade removes the user's own records (jobs, proposals, own vehicles,
      // received ratings, notifications, tokens); SET NULL detaches shared ones
      // (messages sender/receiver, ratings.from_user, payments payer/payee,
      // audit_logs actor) so the counterparty's copy survives.
      await manager.query(`DELETE FROM users WHERE id = $1`, [userId]);

      // Recompute each surviving ratee's aggregate so a rating whose author is now
      // null still reflects correctly (and any received rating that cascaded out
      // is removed from their average).
      for (const { to_user_id } of ratedRows) {
        await manager.query(
          `UPDATE users u SET
             average_rating = COALESCE((
               SELECT AVG(score) FROM ratings WHERE to_user_id = u.id), 0),
             rating_count = (
               SELECT COUNT(*) FROM ratings WHERE to_user_id = u.id)
           WHERE u.id = $1`,
          [to_user_id],
        );
      }
    });

    this.logger.log(
      `Account ${userId} deleted (files purged: ${filesPurged}, blocklisted: ${blocklisted})`,
    );
    return { filesPurged, blocklisted };
  }
}
