import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
} from 'class-validator';

export class RouteQueryDto {
  @ApiProperty({ example: -1.9403 })
  @Type(() => Number)
  @IsLatitude()
  from_lat: number;

  @ApiProperty({ example: 30.1127 })
  @Type(() => Number)
  @IsLongitude()
  from_lng: number;

  @ApiProperty({ example: -1.9397 })
  @Type(() => Number)
  @IsLatitude()
  to_lat: number;

  @ApiProperty({ example: 30.0403 })
  @Type(() => Number)
  @IsLongitude()
  to_lng: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Include ordered turn-by-turn instructions',
  })
  @IsOptional()
  // Query strings arrive as text; treat only "true"/"1" as true.
  @Transform(({ value }) => value === 'true' || value === '1' || value === true)
  @IsBoolean()
  steps?: boolean;
}

// Source of distance_km/duration_min, so a client (and pricing) can see when the
// road router was unavailable and the great-circle fallback was used.
export enum DistanceSource {
  OSRM = 'osrm',
  GREAT_CIRCLE = 'great_circle',
}

export class RouteInstructionDto {
  @ApiProperty({
    example: 'Turn left onto KG 11 Ave',
    description: 'Human-readable instruction, composed server-side',
  })
  text: string;

  @ApiProperty({ example: 'turn', description: 'OSRM maneuver type' })
  maneuver_type: string;

  @ApiPropertyOptional({
    example: 'left',
    nullable: true,
    description: 'OSRM maneuver modifier (direction), when present',
  })
  modifier: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Street name entered by this step, when named',
  })
  street: string | null;

  @ApiProperty({ description: 'Distance travelled along this step, metres' })
  distance_m: number;

  @ApiProperty({ description: 'Duration of this step, seconds' })
  duration_s: number;

  @ApiProperty({ description: 'Latitude of the maneuver point' })
  lat: number;

  @ApiProperty({ description: 'Longitude of the maneuver point' })
  lng: number;
}

export class RouteResponseDto {
  @ApiProperty({
    description: 'Road distance in km (great-circle on fallback)',
  })
  distance_km: number;

  @ApiProperty({
    nullable: true,
    description:
      'Driving duration in minutes; null on the great-circle fallback',
  })
  duration_min: number | null;

  @ApiProperty({
    nullable: true,
    description:
      'Encoded polyline (precision 5) of the route; null on the fallback',
  })
  polyline: string | null;

  @ApiProperty({ enum: DistanceSource })
  distance_source: DistanceSource;

  @ApiPropertyOptional({
    type: [RouteInstructionDto],
    description:
      'Ordered instructions; present only when steps=true and OSRM answered',
  })
  instructions?: RouteInstructionDto[];
}
