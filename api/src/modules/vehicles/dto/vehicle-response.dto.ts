import { ApiProperty } from '@nestjs/swagger';
import { VehicleType } from '../../../common/enums';
import { Vehicle } from '../entities/vehicle.entity';

export class VehicleResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() driverId: string;
  @ApiProperty({ enum: VehicleType }) type: VehicleType;
  @ApiProperty({ nullable: true }) capacityKg: number | null;
  @ApiProperty() regNo: string;
  @ApiProperty({ nullable: true }) photoUrl: string | null;

  static from(v: Vehicle): VehicleResponseDto {
    return {
      id: v.id,
      driverId: v.driverId,
      type: v.type,
      capacityKg: v.capacityKg != null ? Number(v.capacityKg) : null,
      regNo: v.regNo,
      photoUrl: v.photoUrl,
    };
  }
}
