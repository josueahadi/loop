import { ApiProperty } from '@nestjs/swagger';
import { VehicleType } from '../../../common/enums';

export class NearbyVehicleDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: VehicleType }) type: VehicleType;
  @ApiProperty({ nullable: true }) capacityKg: number | null;
  @ApiProperty() regNo: string;
  @ApiProperty({ nullable: true }) photoUrl: string | null;
}

export class NearbyDriverDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() averageRating: number;
  @ApiProperty() lat: number;
  @ApiProperty() lng: number;
  @ApiProperty({ description: 'Straight-line distance in metres' })
  distanceM: number;
  @ApiProperty({ type: [NearbyVehicleDto] })
  vehicles: NearbyVehicleDto[];
}
