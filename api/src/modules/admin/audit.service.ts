import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DirectoryQuery, Paginated } from './dto/directory-query.dto';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditContext {
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditEntry extends AuditContext {
  actorId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  // Best-effort: an audit-write failure must never fail the underlying action.
  async record(entry: AuditEntry): Promise<void> {
    try {
      const log = this.logs.create({
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: entry.metadata ?? null,
      });
      await this.logs.save(log);
    } catch (err) {
      this.logger.error('Audit write failed (continuing)', err as Error);
    }
  }

  async list(q: DirectoryQuery): Promise<Paginated<any>> {
    const limit = q.limit;
    const offset = (q.page - 1) * q.limit;
    const where: string[] = ['1 = 1'];
    const params: any[] = [];
    if (q.filter?.trim()) {
      params.push(q.filter.trim());
      where.push(`a.action = $${params.length}`);
    }
    const clause = `FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id WHERE ${where.join(
      ' AND ',
    )}`;

    const data = await this.ds.query(
      `SELECT a.id, a.action,
              a.target_type AS "targetType",
              a.target_id AS "targetId",
              a.ip, a.user_agent AS "userAgent",
              a.metadata, a.created_at AS "createdAt",
              CASE WHEN u.id IS NULL THEN NULL ELSE
                json_build_object('id', u.id, 'name', u.name, 'email', u.email, 'role', u.role)
              END AS actor
       ${clause}
       ORDER BY a.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const [{ count }] = await this.ds.query(
      `SELECT COUNT(*)::int AS count ${clause}`,
      params,
    );
    return { data, total: count, page: q.page, limit: q.limit };
  }
}
