import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PaymentStatus } from '../../../common/enums';
import { Job } from '../../jobs/entities/job.entity';
import { User } from '../../users/entities/user.entity';

// M8 pass-through payment record. Loop never holds the funds — this row only
// captures a settlement the provider (Flutterwave) confirmed via webhook.
// `amount` is locked server-side to the job's posted price. At most one
// successful PAYMENT per job is enforced by a partial unique index in the
// migration (uq_payment_job_successful), not here, since TypeORM's @Unique can't
// express a WHERE clause.
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'job_id' })
  jobId: string;

  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  // The job's owner (who pays).
  @Column({ name: 'payer_id' })
  payerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payer_id' })
  payer: User;

  // The accepted driver (who is paid).
  @Column({ name: 'payee_id' })
  payeeId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payee_id' })
  payee: User;

  // Whole RWF (zero-decimal currency). Locked to the job's posted price.
  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'varchar', default: 'RWF' })
  currency: string;

  // Which PAYMENT_DRIVER produced this row (stub | flutterwave).
  @Column({ type: 'varchar' })
  provider: string;

  // The provider's transaction reference; unique so a webhook replay resolves to
  // the same row (idempotency key).
  @Index({ unique: true })
  @Column({ name: 'provider_ref', type: 'varchar' })
  providerRef: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'failure_reason', type: 'varchar', nullable: true })
  failureReason: string | null;

  // Full provider webhook body, retained for audit / dispute resolution.
  @Column({ name: 'raw_webhook_payload', type: 'jsonb', nullable: true })
  rawWebhookPayload: unknown;
}
