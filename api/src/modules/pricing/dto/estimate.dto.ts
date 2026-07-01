import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { JobSize, VehicleType } from '../../../common/enums';

export class LatLngDto {
  @ApiProperty({ example: -1.9441 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 30.0619 })
  @IsLongitude()
  lng: number;
}

export class EstimateDto {
  @ApiProperty({ type: LatLngDto })
  @ValidateNested()
  @Type(() => LatLngDto)
  pickup: LatLngDto;

  @ApiProperty({ type: LatLngDto })
  @ValidateNested()
  @Type(() => LatLngDto)
  drop_off: LatLngDto;

  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType)
  vehicle_type: VehicleType;

  @ApiProperty({ enum: JobSize })
  @IsEnum(JobSize)
  size: JobSize;

  // Part of the load profile; does NOT affect the price (size_factor captures the
  // load effect). Accepted for the job record, ignored by the estimate formula.
  @ApiPropertyOptional({ description: 'Cargo weight in kg (not a price input)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight_kg?: number;
}

export class EstimateResponseDto {
  @ApiProperty({ description: 'Suggested price in whole RWF' })
  suggested_price: number;

  @ApiProperty({ description: 'Great-circle distance in km' })
  distance_km: number;
}
