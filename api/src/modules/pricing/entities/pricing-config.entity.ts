import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { VehicleType } from '../../../common/enums';

// Per-vehicle-type pricing parameters (RWF integers). Editable without redeploy.
// Consumed by the pricing estimate in M3; seeded in M1.
@Entity('pricing_config')
@Unique('uq_pricing_vehicle_type', ['vehicleType'])
export class PricingConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_type', type: 'enum', enum: VehicleType })
  vehicleType: VehicleType;

  @Column({ name: 'base_fare', type: 'integer' })
  baseFare: number;

  @Column({ name: 'rate_per_km', type: 'integer' })
  ratePerKm: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
