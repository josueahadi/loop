import {
  BadRequestException,
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
  SELECT id, owner_id AS "ownerId", pickup AS "pickupLabel",
         ST_Y(pickup_location::geometry) AS "pickupLat",
         ST_X(pickup_location::geometry) AS "pickupLng",
         drop_off AS "dropOffLabel",
         ST_Y(drop_off_location::geometry) AS "dropOffLat",
         ST_X(drop_off_location::geometry) AS "dropOffLng",
         cargo_type AS "cargoType", size, weight_kg AS "weightKg",
         suggested_price AS "suggestedPrice", price,
         req_vehicle_type AS "reqVehicleType", status,
         created_at AS "createdAt", posted_at AS "postedAt",
         matched_at AS "matchedAt", accepted_at AS "acceptedAt",
         in_progress_at AS "inProgressAt", completed_at AS "completedAt",
         cancelled_at AS "cancelledAt"
  FROM jobs`;

// Which *_at column a status transition stamps (accepted_at is set on proposal
// acceptance in M4, not via a direct job-status PATCH).
const STATUS_TIMESTAMP: Partial<Record<JobStatus, string>> = {
  [JobStatus.POSTED]: 'posted_at',
  [JobStatus.MATCHED]: 'matched_at',
  [JobStatus.IN_PROGRESS]: 'in_progress_at',
  [JobStatus.COMPLETED]: 'completed_at',
  [JobStatus.CANCELLED]: 'cancelled_at',
};

@Injectable()
export class JobsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Owner creates a posted job. Pins stored as geography; both prices persisted.
  async create(ownerId: string, dto: CreateJobDto): Promise<JobResponseDto> {
    const pickupLabel =
      dto.pickupLabel ?? `${dto.pickup.lat}, ${dto.pickup.lng}`;
    const dropOffLabel =
      dto.dropOffLabel ?? `${dto.dropOff.lat}, ${dto.dropOff.lng}`;

    const [{ id }] = await this.dataSource.query(
      `INSERT INTO jobs
         (owner_id, pickup, pickup_location, drop_off, drop_off_location,
          cargo_type, size, weight_kg, suggested_price, price,
          req_vehicle_type, status, posted_at)
       VALUES
         ($1, $2, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography,
          $5, ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography,
          $8, $9, $10, $11, $12, $13, 'posted', now())
       RETURNING id`,
      [
        ownerId,
        pickupLabel,
        dto.pickup.lat,
        dto.pickup.lng,
        dropOffLabel,
        dto.dropOff.lat,
        dto.dropOff.lng,
        dto.cargoType,
        dto.size,
        dto.weightKg ?? null,
        dto.suggestedPrice,
        dto.price,
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
    await this.getOwned(id, ownerId); // ownership + existence
    const tsColumn = STATUS_TIMESTAMP[status];
    if (!tsColumn) {
      throw new BadRequestException(`Cannot transition to ${status}`);
    }
    // Stamp the transition time only the first time it happens.
    await this.dataSource.query(
      `UPDATE jobs
         SET status = $1,
             ${tsColumn} = COALESCE(${tsColumn}, now())
       WHERE id = $2 AND owner_id = $3`,
      [status, id, ownerId],
    );
    return this.getOwned(id, ownerId);
  }
}
