import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { VerificationStatus } from '../../common/enums';
import { DirectoryQuery, Paginated } from './dto/directory-query.dto';

const REQUIRED_DOCUMENTS = ['licence', 'national_id', 'vehicle_reg'] as const;

@Injectable()
export class AdminDirectoryService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // Page/limit → SQL LIMIT/OFFSET. Returns the slice bounds + params index.
  private paginate(q: DirectoryQuery): { limit: number; offset: number } {
    return { limit: q.limit, offset: (q.page - 1) * q.limit };
  }

  private envelope<T>(
    data: T[],
    total: number,
    q: DirectoryQuery,
  ): Paginated<T> {
    return { data, total, page: q.page, limit: q.limit };
  }

  async listVerifications(status: VerificationStatus) {
    return this.ds.query(
      `SELECT vr.id,
              vr.driver_id AS "driverId",
              vr.document_type AS "documentType",
              vr.status,
              vr.reviewed_at AS "reviewedAt",
              vr.created_at AS "createdAt",
              json_build_object(
                'id', u.id,
                'name', u.name,
                'email', u.email,
                'phone', u.phone
              ) AS driver
       FROM verification_records vr
       JOIN users u ON u.id = vr.driver_id
       WHERE vr.status = $1
       ORDER BY vr.created_at ASC`,
      [status],
    );
  }

  async listDrivers(q: DirectoryQuery): Promise<Paginated<any>> {
    const { limit, offset } = this.paginate(q);
    // search matches name/email/phone; filter = matchable | blocked (computed
    // from vehicle + approved-doc counts via HAVING so paging is correct).
    const where: string[] = [`u.role = 'driver'`];
    const params: any[] = [];
    if (q.search?.trim()) {
      params.push(`%${q.search.trim()}%`);
      where.push(
        `(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.phone ILIKE $${params.length})`,
      );
    }
    const matchable = `COUNT(DISTINCT v.id) >= 1 AND COUNT(DISTINCT vr.document_type) FILTER (WHERE vr.status = 'approved' AND vr.document_type IN ('licence','national_id','vehicle_reg')) >= ${REQUIRED_DOCUMENTS.length}`;
    let having = '';
    if (q.filter === 'matchable') having = `HAVING ${matchable}`;
    else if (q.filter === 'blocked') having = `HAVING NOT (${matchable})`;

    const base = `
       FROM users u
       LEFT JOIN vehicles v ON v.driver_id = u.id
       LEFT JOIN verification_records vr ON vr.driver_id = u.id
       WHERE ${where.join(' AND ')}
       GROUP BY u.id ${having}`;

    const rows = await this.ds.query(
      `SELECT u.id, u.name, u.email, u.phone,
              u.availability_status AS "availabilityStatus",
              COUNT(DISTINCT v.id)::int AS "vehicleCount",
              COUNT(DISTINCT vr.document_type) FILTER
                (WHERE vr.status = 'approved'
                   AND vr.document_type IN ('licence','national_id','vehicle_reg'))::int
                AS "approvedDocumentCount"
       ${base}
       ORDER BY MAX(u.created_at) DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const [{ count }] = await this.ds.query(
      `SELECT COUNT(*)::int AS count FROM (SELECT u.id ${base}) t`,
      params,
    );

    const data = rows.map((row: any) => {
      const missing: string[] = [];
      if (row.vehicleCount < 1) missing.push('vehicle');
      if (row.approvedDocumentCount < REQUIRED_DOCUMENTS.length) {
        missing.push('documents');
      }
      return {
        ...row,
        matchabilityStatus: missing.length === 0 ? 'matchable' : 'blocked',
        missing,
      };
    });
    return this.envelope(data, count, q);
  }

  async listUsers(q: DirectoryQuery): Promise<Paginated<any>> {
    const { limit, offset } = this.paginate(q);
    const where: string[] = ['1 = 1'];
    const params: any[] = [];
    if (q.search?.trim()) {
      params.push(`%${q.search.trim()}%`);
      where.push(
        `(name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length})`,
      );
    }
    if (q.filter && ['cargo_owner', 'driver', 'admin'].includes(q.filter)) {
      params.push(q.filter);
      where.push(`role = $${params.length}`);
    }
    const clause = `FROM users WHERE ${where.join(' AND ')}`;

    const data = await this.ds.query(
      `SELECT id, name, email, phone, role,
              email_verified_at AS "emailVerifiedAt",
              average_rating AS "averageRating",
              rating_count AS "ratingCount",
              created_at AS "createdAt"
       ${clause}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const [{ count }] = await this.ds.query(
      `SELECT COUNT(*)::int AS count ${clause}`,
      params,
    );
    return this.envelope(data, count, q);
  }

  async listJobs(q: DirectoryQuery): Promise<Paginated<any>> {
    const { limit, offset } = this.paginate(q);
    const where: string[] = ['1 = 1'];
    const params: any[] = [];
    if (q.search?.trim()) {
      params.push(`%${q.search.trim()}%`);
      where.push(
        `(j.cargo_type ILIKE $${params.length} OR j.pickup_label ILIKE $${params.length} OR j.drop_off_label ILIKE $${params.length})`,
      );
    }
    if (q.filter?.trim()) {
      params.push(q.filter.trim());
      where.push(`j.status = $${params.length}`);
    }
    const clause = `FROM jobs j JOIN users u ON u.id = j.owner_id WHERE ${where.join(' AND ')}`;

    const data = await this.ds.query(
      `SELECT j.id, j.status,
              j.cargo_type AS "cargoType", j.size,
              j.req_vehicle_type AS "requiredVehicleType",
              j.price, j.estimated_price AS "estimatedPrice",
              j.pickup_label AS "pickupLabel",
              j.drop_off_label AS "dropOffLabel",
              j.created_at AS "createdAt",
              j.posted_at AS "postedAt",
              j.matched_at AS "matchedAt",
              json_build_object('id', u.id, 'name', u.name, 'email', u.email, 'phone', u.phone) AS owner
       ${clause}
       ORDER BY j.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const [{ count }] = await this.ds.query(
      `SELECT COUNT(*)::int AS count ${clause}`,
      params,
    );
    return this.envelope(data, count, q);
  }
}
