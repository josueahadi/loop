import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JobSize, JobStatus, VehicleType } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';

// Created in M1 so metrics accrue from day one; endpoints land in M3.
@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  // Reverse-geocoded display text for the pin (nullable). The pin itself is the
  // geography point below.
  @Column({ name: 'pickup_label', type: 'varchar', nullable: true })
  pickupLabel: string | null;

  @Column({ name: 'pickup_notes', type: 'text', nullable: true })
  pickupNotes: string | null;

  @Column({
    name: 'pickup_location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  pickupLocation: string | null;

  @Column({ name: 'drop_off_label', type: 'varchar', nullable: true })
  dropOffLabel: string | null;

  @Column({ name: 'drop_off_notes', type: 'text', nullable: true })
  dropOffNotes: string | null;

  @Column({
    name: 'drop_off_location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  dropOffLocation: string | null;

  @Column({ name: 'cargo_type' })
  cargoType: string;

  @Column({ type: 'enum', enum: JobSize })
  size: JobSize;

  @Column({ name: 'weight_kg', type: 'numeric', nullable: true })
  weightKg: number | null;

  // RWF, integer whole francs (zero-decimal currency). Never minor units.
  // Cost estimate (ride-hailing style), distinct from the owner-set `price`.
  @Column({ name: 'estimated_price', type: 'integer', nullable: true })
  estimatedPrice: number | null;

  @Column({ type: 'integer', nullable: true })
  price: number | null;

  // Route inputs actually used for the estimate (M7). Persisted as instrumentation
  // for a future learned pricing model — they can't be reconstructed later.
  // numeric columns come back as strings from pg; parsed at the read boundary.
  @Column({
    name: 'distance_km',
    type: 'numeric',
    precision: 7,
    scale: 2,
    nullable: true,
  })
  distanceKm: string | null;

  @Column({
    name: 'duration_min',
    type: 'numeric',
    precision: 7,
    scale: 1,
    nullable: true,
  })
  durationMin: string | null;

  @Column({ name: 'distance_source', type: 'varchar', nullable: true })
  distanceSource: string | null;

  @Column({ name: 'req_vehicle_type', type: 'enum', enum: VehicleType })
  reqVehicleType: VehicleType;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.DRAFT })
  status: JobStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Status-transition timestamps (no event table) — feed the metrics dashboard.
  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt: Date | null;

  @Column({ name: 'matched_at', type: 'timestamptz', nullable: true })
  matchedAt: Date | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'in_progress_at', type: 'timestamptz', nullable: true })
  inProgressAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;
}
