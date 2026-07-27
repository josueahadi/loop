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

  // v2 (M7): time term and a floor. RWF integers.
  @Column({ name: 'rate_per_min', type: 'integer', default: 0 })
  ratePerMin: number;

  // v3: per-kg term so weight is a direct price input (not just via size_factor).
  @Column({ name: 'rate_per_kg', type: 'integer', default: 0 })
  ratePerKg: number;

  @Column({ name: 'min_fare', type: 'integer', default: 0 })
  minFare: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
