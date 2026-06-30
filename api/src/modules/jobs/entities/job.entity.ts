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

  @Column()
  pickup: string;

  @Column({
    name: 'pickup_location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  pickupLocation: string | null;

  @Column({ name: 'drop_off' })
  dropOff: string;

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
  @Column({ name: 'suggested_price', type: 'integer', nullable: true })
  suggestedPrice: number | null;

  @Column({ type: 'integer', nullable: true })
  price: number | null;

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
