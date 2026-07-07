import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// An in-app notification for a user. Written whenever the app pushes to a user
// (proposal received/accepted/declined, new message, verification decision), so
// the mobile notification centre has a persisted history independent of FCM.
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  title: string;

  @Column()
  body: string;

  // Free-form payload mirroring the push data (e.g. { type, jobId }).
  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, string> | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
