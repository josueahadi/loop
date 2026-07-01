import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  pickupLabel?: string;

  @ApiProperty({ type: LatLngDto })
  @ValidateNested()
  @Type(() => LatLngDto)
  dropOff: LatLngDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  dropOffLabel?: string;

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

  @ApiProperty({ description: 'Estimated cost (whole RWF) from /pricing/estimate' })
  @IsInt()
  @Min(0)
  estimatedPrice: number;

  @ApiProperty({ description: 'Final price the owner posts (whole RWF)' })
  @IsInt()
  @Min(0)
  price: number;
}
