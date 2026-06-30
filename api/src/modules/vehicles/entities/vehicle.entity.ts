import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VehicleType } from '../../../common/enums';
import { User } from '../../users/entities/user.entity';

// Lean per locked decision #7: {type, capacity, reg_no, photo}. CRUD lands in M2.
@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'driver_id' })
  driverId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  @Column({ type: 'enum', enum: VehicleType })
  type: VehicleType;

  // Kilograms — consistent unit across jobs/vehicles/pricing (locked decision: units).
  @Column({ name: 'capacity_kg', type: 'numeric', nullable: true })
  capacityKg: number | null;

  @Column({ name: 'reg_no' })
  regNo: string;

  @Column({ name: 'photo_url', type: 'varchar', nullable: true })
  photoUrl: string | null;
}
