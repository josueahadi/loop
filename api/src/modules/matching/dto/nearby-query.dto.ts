import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { VehicleType } from '../../../common/enums';

// Owner's current location + optional filters. Query strings are coerced to numbers
// by the global ValidationPipe (enableImplicitConversion).
export class NearbyQueryDto {
  @ApiProperty({ example: -1.9441 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 30.0619 })
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({ enum: VehicleType })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicle_type?: VehicleType;

  @ApiPropertyOptional({ description: 'Search radius in km (defaults to config)' })
  @IsOptional()
  @IsPositive()
  radius?: number;
}
