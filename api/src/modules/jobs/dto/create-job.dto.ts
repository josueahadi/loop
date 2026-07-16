import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { JobSize, VehicleType } from '../../../common/enums';
import { LatLngDto } from '../../pricing/dto/estimate.dto';

// Owner creates and posts a job. Pins are required (pin-based flow, no geocoding);
// the *Label fields are optional human labels (default to a coordinate string).
// Both estimated_price and the final owner-set price are persisted (integer RWF).
export class CreateJobDto {
  @ApiProperty({ type: LatLngDto })
  @ValidateNested()
  @Type(() => LatLngDto)
  pickup: LatLngDto;

  @ApiPropertyOptional({ description: 'Reverse-geocoded / searched label' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pickupLabel?: string;

  @ApiPropertyOptional({ description: 'Free-text note, e.g. "blue gate"' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pickupNotes?: string;

  @ApiProperty({ type: LatLngDto })
  @ValidateNested()
  @Type(() => LatLngDto)
  dropOff: LatLngDto;

  @ApiPropertyOptional({ description: 'Reverse-geocoded / searched label' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dropOffLabel?: string;

  @ApiPropertyOptional({ description: 'Free-text note, e.g. "2nd house"' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dropOffNotes?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  cargoType: string;

  @ApiProperty({ enum: JobSize })
  @IsEnum(JobSize)
  size: JobSize;

  @ApiPropertyOptional({ description: 'Cargo weight in kg' })
  @IsOptional()
  @Min(0)
  weightKg?: number;

  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType)
  reqVehicleType: VehicleType;

  @ApiProperty({
    description: 'Estimated cost (whole RWF) from /pricing/estimate',
  })
  @IsInt()
  @Min(0)
  estimatedPrice: number;

  @ApiProperty({ description: 'Final price the owner posts (whole RWF)' })
  @IsInt()
  @Min(0)
  price: number;

  // Route inputs from /pricing/estimate, echoed back so the JOB records the
  // distance/duration/source the estimate was actually built on (instrumentation
  // for a future learned pricing model). Optional/nullable — a client that skips
  // the estimate still posts a valid job.
  @ApiPropertyOptional({ description: 'Distance used for the estimate, km' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional({
    description: 'Duration used for the estimate, minutes',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  durationMin?: number;

  @ApiPropertyOptional({ enum: ['osrm', 'great_circle'] })
  @IsOptional()
  @IsIn(['osrm', 'great_circle'])
  distanceSource?: string;
}
