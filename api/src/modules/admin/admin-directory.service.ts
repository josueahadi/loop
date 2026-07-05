import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { VerificationStatus } from '../../common/enums';

const REQUIRED_DOCUMENTS = ['licence', 'national_id', 'vehicle_reg'] as const;

@Injectable()
export class AdminDirectoryService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

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

  async listDrivers() {
    const rows = await this.ds.query(
      `SELECT u.id,
              u.name,
              u.email,
              u.phone,
              u.availability_status AS "availabilityStatus",
              COUNT(DISTINCT v.id)::int AS "vehicleCount",
              COUNT(DISTINCT vr.document_type) FILTER
                (WHERE vr.status = 'approved'
                   AND vr.document_type IN ('licence', 'national_id', 'vehicle_reg'))::int
                AS "approvedDocumentCount"
       FROM users u
       LEFT JOIN vehicles v ON v.driver_id = u.id
       LEFT JOIN verification_records vr ON vr.driver_id = u.id
       WHERE u.role = 'driver'
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
    );

    return rows.map((row: any) => {
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
  }

  async listUsers() {
    return this.ds.query(
      `SELECT id,
              name,
              email,
              phone,
              role,
              email_verified_at AS "emailVerifiedAt",
              average_rating AS "averageRating",
              rating_count AS "ratingCount",
              created_at AS "createdAt"
       FROM users
       ORDER BY created_at DESC`,
    );
  }

  async listJobs() {
    return this.ds.query(
      `SELECT j.id,
              j.status,
              j.cargo_type AS "cargoType",
              j.size,
              j.req_vehicle_type AS "requiredVehicleType",
              j.price,
              j.estimated_price AS "estimatedPrice",
              j.pickup_label AS "pickupLabel",
              j.drop_off_label AS "dropOffLabel",
              j.created_at AS "createdAt",
              j.posted_at AS "postedAt",
              j.matched_at AS "matchedAt",
              json_build_object(
                'id', u.id,
                'name', u.name,
                'email', u.email,
                'phone', u.phone
              ) AS owner
       FROM jobs j
       JOIN users u ON u.id = j.owner_id
       ORDER BY j.created_at DESC
       LIMIT 200`,
    );
  }
}
