import { Injectable, NotFoundException } from '@nestjs/common';
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

  // Grouped by driver: one entry per driver carrying all their documents at the
  // requested status, so the queue shows a single row per driver (not per doc).
  async listVerifications(status: VerificationStatus) {
    return this.ds.query(
      `SELECT json_build_object(
                'id', u.id,
                'name', u.name,
                'email', u.email,
                'phone', u.phone
              ) AS driver,
              json_agg(
                json_build_object(
                  'id', vr.id,
                  'documentType', vr.document_type,
                  'status', vr.status,
                  'reviewNote', vr.review_note,
                  'reviewedAt', vr.reviewed_at,
                  'createdAt', vr.created_at
                ) ORDER BY vr.created_at ASC
              ) AS documents,
              COUNT(*)::int AS "documentCount"
       FROM verification_records vr
       JOIN users u ON u.id = vr.driver_id
       WHERE vr.status = $1
       GROUP BY u.id
       ORDER BY MIN(vr.created_at) ASC`,
      [status],
    );
  }

  // Full profile for one user + their related data, for the admin detail page.
  // Driver → vehicles, documents, matchability; owner → posted jobs. Both →
  // ratings received/given. Assembled from focused queries (small per-user sets).
  async getUserProfile(id: string): Promise<any> {
    const [user] = await this.ds.query(
      `SELECT id, name, email, phone, role,
              photo_url AS "photoUrl",
              availability_status AS "availabilityStatus",
              email_verified_at AS "emailVerifiedAt",
              average_rating AS "averageRating",
              rating_count AS "ratingCount",
              created_at AS "createdAt"
       FROM users WHERE id = $1`,
      [id],
    );
    if (!user) throw new NotFoundException('User not found');

    const ratingsReceived = await this.ds.query(
      `SELECT r.score, r.comment, r.created_at AS "createdAt",
              r.job_id AS "jobId", fu.name AS "fromName"
       FROM ratings r JOIN users fu ON fu.id = r.from_user_id
       WHERE r.to_user_id = $1
       ORDER BY r.created_at DESC`,
      [id],
    );
    const ratingsGiven = await this.ds.query(
      `SELECT r.score, r.comment, r.created_at AS "createdAt",
              r.job_id AS "jobId", tu.name AS "toName"
       FROM ratings r JOIN users tu ON tu.id = r.to_user_id
       WHERE r.from_user_id = $1
       ORDER BY r.created_at DESC`,
      [id],
    );

    const base = { ...user, ratingsReceived, ratingsGiven };

    if (user.role === 'driver') {
      const vehicles = await this.ds.query(
        `SELECT id, type, capacity_kg AS "capacityKg", reg_no AS "regNo",
                photo_url AS "photoUrl"
         FROM vehicles WHERE driver_id = $1`,
        [id],
      );
      const documents = await this.ds.query(
        `SELECT id, document_type AS "documentType", status,
                review_note AS "reviewNote", reviewed_at AS "reviewedAt",
                created_at AS "createdAt"
         FROM verification_records WHERE driver_id = $1
         ORDER BY created_at DESC`,
        [id],
      );
      // Same matchability rule as the drivers list (≥1 vehicle + all 3 docs approved).
      const approvedTypes = new Set(
        documents
          .filter(
            (d: any) =>
              d.status === 'approved' &&
              REQUIRED_DOCUMENTS.includes(d.documentType),
          )
          .map((d: any) => d.documentType),
      );
      const missing: string[] = [];
      if (vehicles.length < 1) missing.push('vehicle');
      if (approvedTypes.size < REQUIRED_DOCUMENTS.length) missing.push('documents');
      const assignedJobs = await this.ds.query(
        `SELECT j.id, j.cargo_type AS "cargoType", j.status,
                j.price, j.estimated_price AS "estimatedPrice",
                j.pickup_label AS "pickupLabel", j.drop_off_label AS "dropOffLabel",
                j.created_at AS "createdAt"
         FROM jobs j JOIN proposals p ON p.job_id = j.id
         WHERE p.driver_id = $1 AND p.status = 'accepted'
         ORDER BY j.created_at DESC`,
        [id],
      );
      return {
        ...base,
        vehicles,
        documents,
        matchabilityStatus: missing.length === 0 ? 'matchable' : 'blocked',
        missing,
        assignedJobs,
      };
    }

    if (user.role === 'cargo_owner') {
      const jobs = await this.ds.query(
        `SELECT id, cargo_type AS "cargoType", status,
                price, estimated_price AS "estimatedPrice",
                pickup_label AS "pickupLabel", drop_off_label AS "dropOffLabel",
                created_at AS "createdAt"
         FROM jobs WHERE owner_id = $1
         ORDER BY created_at DESC`,
        [id],
      );
      return { ...base, jobs };
    }

    return base;
  }

  // Full detail for one job + its proposals, message count, and ratings, for
  // the admin job-detail page. Mirrors getUserProfile's focused-query approach.
  async getJobDetail(id: string): Promise<any> {
    const [job] = await this.ds.query(
      `SELECT j.id, j.cargo_type AS "cargoType", j.size,
              j.weight_kg AS "weightKg",
              j.price, j.estimated_price AS "estimatedPrice",
              j.req_vehicle_type AS "requiredVehicleType", j.status,
              j.pickup_label AS "pickupLabel", j.pickup_notes AS "pickupNotes",
              j.drop_off_label AS "dropOffLabel", j.drop_off_notes AS "dropOffNotes",
              j.created_at AS "createdAt", j.posted_at AS "postedAt",
              j.matched_at AS "matchedAt", j.accepted_at AS "acceptedAt",
              j.in_progress_at AS "inProgressAt", j.completed_at AS "completedAt",
              j.cancelled_at AS "cancelledAt",
              json_build_object('id', u.id, 'name', u.name, 'email', u.email, 'phone', u.phone) AS owner
       FROM jobs j JOIN users u ON u.id = j.owner_id
       WHERE j.id = $1`,
      [id],
    );
    if (!job) throw new NotFoundException('Job not found');

    const proposals = await this.ds.query(
      `SELECT p.id, p.status, p.created_at AS "createdAt",
              p.responded_at AS "respondedAt",
              json_build_object('id', du.id, 'name', du.name, 'phone', du.phone) AS driver
       FROM proposals p JOIN users du ON du.id = p.driver_id
       WHERE p.job_id = $1
       ORDER BY p.created_at ASC`,
      [id],
    );
    const [{ count: messageCount }] = await this.ds.query(
      `SELECT COUNT(*)::int AS count FROM messages WHERE job_id = $1`,
      [id],
    );
    const ratings = await this.ds.query(
      `SELECT r.score, r.comment, r.created_at AS "createdAt",
              fu.name AS "fromName", tu.name AS "toName"
       FROM ratings r
       JOIN users fu ON fu.id = r.from_user_id
       JOIN users tu ON tu.id = r.to_user_id
       WHERE r.job_id = $1
       ORDER BY r.created_at ASC`,
      [id],
    );
    return { ...job, proposals, messageCount, ratings };
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
