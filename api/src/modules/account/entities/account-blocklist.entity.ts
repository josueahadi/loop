import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// A minimal record kept when a driver is removed for fraud (false documents),
// so the same email/phone cannot immediately re-register. Only salted hashes are
// stored — never the raw email or phone — so this is not a re-identifiable copy
// of the deleted person's contact details.
@Entity('account_blocklist')
export class AccountBlocklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'email_hash', type: 'varchar' })
  emailHash: string;

  @Index()
  @Column({ name: 'phone_hash', type: 'varchar' })
  phoneHash: string;

  @Column({ type: 'varchar' })
  reason: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
