import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { ActionTokenType } from '../../common/enums';
import { ActionToken } from './entities/action-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';

// Issues and validates opaque refresh tokens and single-use action tokens.
// Only SHA-256 hashes are persisted; the raw value is returned/emailed once.
@Injectable()
export class TokensService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(ActionToken)
    private readonly actionTokens: Repository<ActionToken>,
    private readonly config: ConfigService,
  ) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private ttlMs(ttl: string): number {
    // Supports "30d", "15m", "24h", "3600s" or a raw number of seconds.
    const m = /^(\d+)([smhd])?$/.exec(ttl.trim());
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    const unit = m[2] ?? 's';
    const mult = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[unit]!;
    return n * mult;
  }

  // ---- refresh tokens ----
  async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() +
        this.ttlMs(this.config.get<string>('jwt.refreshTtl') ?? '30d'),
    );
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId,
        tokenHash: this.hash(raw),
        expiresAt,
      }),
    );
    return raw;
  }

  // Validate + rotate: returns the userId and a fresh raw token, or null if invalid.
  async rotateRefreshToken(
    raw: string,
  ): Promise<{ userId: string; refreshToken: string } | null> {
    const record = await this.refreshTokens.findOne({
      where: { tokenHash: this.hash(raw) },
    });
    if (
      !record ||
      record.revokedAt != null ||
      record.expiresAt.getTime() < Date.now()
    ) {
      return null;
    }
    record.revokedAt = new Date();
    await this.refreshTokens.save(record);
    const refreshToken = await this.issueRefreshToken(record.userId);
    return { userId: record.userId, refreshToken };
  }

  async revokeRefreshToken(raw: string): Promise<void> {
    await this.refreshTokens.update(
      { tokenHash: this.hash(raw) },
      { revokedAt: new Date() },
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // ---- action tokens (reset / verify) ----
  async issueActionToken(
    userId: string,
    type: ActionTokenType,
  ): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    const hours = this.config.get<number>('jwt.actionTokenTtlHours') ?? 24;
    const expiresAt = new Date(Date.now() + hours * 36e5);
    await this.actionTokens.save(
      this.actionTokens.create({
        userId,
        type,
        tokenHash: this.hash(raw),
        expiresAt,
      }),
    );
    return raw;
  }

  // Single-use: marks the token used and returns the userId, or null if invalid.
  async consumeActionToken(
    raw: string,
    type: ActionTokenType,
  ): Promise<string | null> {
    const record = await this.actionTokens.findOne({
      where: { tokenHash: this.hash(raw), type },
    });
    if (
      !record ||
      record.usedAt != null ||
      record.expiresAt.getTime() < Date.now()
    ) {
      return null;
    }
    record.usedAt = new Date();
    await this.actionTokens.save(record);
    return record.userId;
  }
}
