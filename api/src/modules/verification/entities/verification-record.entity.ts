import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DocumentType, VerificationStatus } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';

// Per-document verification record. Wired in M1 (driver upload + admin review).
@Entity('verification_records')
export class VerificationRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'driver_id' })
  driverId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  @Column({ name: 'document_type', type: 'enum', enum: DocumentType })
  documentType: DocumentType;

  // Storage object PATH (private bucket), not a public URL.
  @Column({ name: 'storage_reference' })
  storageReference: string;

  @Index()
  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  // Admin's reason on rejection (shown to the driver so they can fix + resubmit).
  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
