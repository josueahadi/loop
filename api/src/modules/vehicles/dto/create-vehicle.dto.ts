import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { VehicleType } from '../../../common/enums';

export class CreateVehicleDto {
  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType)
  type: VehicleType;

  @ApiPropertyOptional({ description: 'Capacity in kilograms' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityKg?: number;

  @ApiProperty()
  @IsString()
  @MaxLength(32)
  regNo: string;

  @ApiPropertyOptional({ description: 'Storage reference to the vehicle photo' })
  @IsOptional()
  @IsString()
  photoUrl?: string;
}
