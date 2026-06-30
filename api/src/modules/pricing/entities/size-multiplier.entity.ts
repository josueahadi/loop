import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { JobSize } from '../../../common/enums';

// Size-bucket -> size_factor lookup, decoupled from vehicle type (refinement #3).
// Formula: base_fare + (rate_per_km * distance_km) * size_factor.
@Entity('size_multipliers')
export class SizeMultiplier {
  @PrimaryColumn({ type: 'enum', enum: JobSize })
  size: JobSize;

  @Column({ type: 'numeric', precision: 4, scale: 2 })
  multiplier: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
