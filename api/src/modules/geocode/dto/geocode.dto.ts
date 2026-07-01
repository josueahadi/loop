import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ description: 'Free-text place / landmark query' })
  @IsString()
  @MinLength(2)
  q: string;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}

export class ReverseQueryDto {
  @ApiProperty({ example: -1.9441 })
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 30.0619 })
  @Type(() => Number)
  @IsLongitude()
  lng: number;
}

export class GeocodeResultDto {
  @ApiProperty({ description: 'Human-readable place label' })
  label: string;
  @ApiProperty() lat: number;
  @ApiProperty() lng: number;
}

export class ReverseResultDto {
  @ApiProperty({ nullable: true }) label: string | null;
}
