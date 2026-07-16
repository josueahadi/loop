import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JobStatus } from '../../common/enums';
import { CreateJobDto } from './dto/create-job.dto';
import { JobResponseDto } from './dto/job-response.dto';

// Column projection reused by every read (geography → lat/lng via ST_Y/ST_X).
const SELECT = `
  SELECT id, owner_id AS "ownerId",
         pickup_label AS "pickupLabel", pickup_notes AS "pickupNotes",
         ST_Y(pickup_location::geometry) AS "pickupLat",
         ST_X(pickup_location::geometry) AS "pickupLng",
         drop_off_label AS "dropOffLabel", drop_off_notes AS "dropOffNotes",
         ST_Y(drop_off_location::geometry) AS "dropOffLat",
         ST_X(drop_off_location::geometry) AS "dropOffLng",
         cargo_type AS "cargoType", size, weight_kg AS "weightKg",
         estimated_price AS "estimatedPrice", price,
         req_vehicle_type AS "reqVehicleType", status,
         created_at AS "createdAt", posted_at AS "postedAt",
         matched_at AS "matchedAt", accepted_at AS "acceptedAt",
         in_progress_at AS "inProgressAt", completed_at AS "completedAt",
         cancelled_at AS "cancelledAt"
  FROM jobs`;

// Which *_at column a status transition stamps.
const STATUS_TIMESTAMP: Partial<Record<JobStatus, string>> = {
  [JobStatus.IN_PROGRESS]: 'in_progress_at',
  [JobStatus.COMPLETED]: 'completed_at',
  [JobStatus.CANCELLED]: 'cancelled_at',
};

// Owner-driven lifecycle via PATCH /jobs/:id. A job becomes 'matched' only through
// proposal acceptance (M4), not here. From there the owner advances the job:
// matched → in_progress (driver has started) → completed (delivered); posted/matched
// jobs can be cancelled. Each transition is only valid from its prior state.
const ALLOWED_TRANSITIONS: Partial<Record<JobStatus, JobStatus[]>> = {
  [JobStatus.POSTED]: [JobStatus.CANCELLED],
  [JobStatus.MATCHED]: [JobStatus.IN_PROGRESS, JobStatus.CANCELLED],
  [JobStatus.IN_PROGRESS]: [JobStatus.COMPLETED],
};

@Injectable()
export class JobsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Owner creates a posted job. Pins stored as geography; both prices persisted.
  async create(ownerId: string, dto: CreateJobDto): Promise<JobResponseDto> {
    const [{ id }] = await this.dataSource.query(
      `INSERT INTO jobs
         (owner_id, pickup_label, pickup_notes, pickup_location,
          drop_off_label, drop_off_notes, drop_off_location,
          cargo_type, size, weight_kg, estimated_price, price,
          distance_km, duration_min, distance_source,
          req_vehicle_type, status, posted_at)
       VALUES
         ($1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
          $6, $7, ST_SetSRID(ST_MakePoint($9, $8), 4326)::geography,
          $10, $11, $12, $13, $14, $15, $16, $17, $18, 'posted', now())
       RETURNING id`,
      [
        ownerId,
        dto.pickupLabel ?? null,
        dto.pickupNotes ?? null,
        dto.pickup.lat,
        dto.pickup.lng,
        dto.dropOffLabel ?? null,
        dto.dropOffNotes ?? null,
        dto.dropOff.lat,
        dto.dropOff.lng,
        dto.cargoType,
        dto.size,
        dto.weightKg ?? null,
        dto.estimatedPrice,
        dto.price,
        dto.distanceKm ?? null,
        dto.durationMin ?? null,
        dto.distanceSource ?? null,
        dto.reqVehicleType,
      ],
    );
    return this.getOwned(id, ownerId);
  }

  async listForOwner(ownerId: string): Promise<JobResponseDto[]> {
    const rows = await this.dataSource.query(
      `${SELECT} WHERE owner_id = $1 ORDER BY created_at DESC`,
      [ownerId],
    );
    return rows.map(JobResponseDto.fromRow);
  }

  async getOwned(id: string, ownerId: string): Promise<JobResponseDto> {
    const rows = await this.dataSource.query(
      `${SELECT} WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
    if (rows.length === 0) throw new NotFoundException('Job not found');
    return JobResponseDto.fromRow(rows[0]);
  }

  async updateStatus(
    id: string,
    ownerId: string,
    status: JobStatus,
  ): Promise<JobResponseDto> {
    const job = await this.getOwned(id, ownerId); // ownership + existence
    const allowed = ALLOWED_TRANSITIONS[job.status] ?? [];
    if (!allowed.includes(status)) {
      throw new ConflictException(
        `Cannot move a ${job.status} job to ${status}`,
      );
    }
    const tsColumn = STATUS_TIMESTAMP[status]!;
    // Guard the transition at the DB too: only flip if still in the prior state.
    await this.dataSource.query(
      `UPDATE jobs
         SET status = $1,
             ${tsColumn} = COALESCE(${tsColumn}, now())
       WHERE id = $2 AND owner_id = $3 AND status = $4`,
      [status, id, ownerId, job.status],
    );
    return this.getOwned(id, ownerId);
  }
}
