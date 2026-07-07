import {
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

// Per-user, per-job read marker. `lastReadAt` is the timestamp up to which the
// user has seen this job's messages; unread = messages from the other party
// sent after it. One row per (user, job) — cheap to update on chat open.
@Entity('message_reads')
export class MessageRead {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @Column({ name: 'last_read_at', type: 'timestamptz' })
  lastReadAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
