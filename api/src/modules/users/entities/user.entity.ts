import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AvailabilityStatus, UserRole } from '../../../common/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // Required + unique; E.164/+250 validated at the DTO layer. Primary identifier in Rwanda.
  @Index({ unique: true })
  @Column()
  phone: string;

  @Index({ unique: true })
  @Column()
  email: string;

  // Never serialized out — see classToPlain excludes / explicit DTO mapping.
  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ name: 'photo_url', type: 'varchar', nullable: true })
  photoUrl: string | null;

  // Populated by the email-verify flow. NOT a login gate in the MVP.
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  // Device FCM registration token for push (nullable until the client registers).
  @Column({ name: 'fcm_token', type: 'varchar', nullable: true })
  fcmToken: string | null;

  // ---- Driver-only fields (null for cargo owners / admin) ----
  @Column({
    name: 'availability_status',
    type: 'enum',
    enum: AvailabilityStatus,
    nullable: true,
  })
  availabilityStatus: AvailabilityStatus | null;

  // PostGIS point (lng lat), SRID 4326. Written in M2 (availability capture).
  @Index('idx_users_location', { spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location: string | null;

  // Reputation aggregate (two-way — applies to owners and drivers once rated).
  @Column({
    name: 'average_rating',
    type: 'numeric',
    precision: 2,
    scale: 1,
    default: 0,
  })
  averageRating: number;

  @Column({ name: 'rating_count', type: 'integer', default: 0 })
  ratingCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
