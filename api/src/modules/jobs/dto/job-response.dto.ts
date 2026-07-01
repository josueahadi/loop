import { ApiProperty } from '@nestjs/swagger';
import { JobSize, JobStatus, VehicleType } from '../../../common/enums';

// Built from a raw row (geography columns projected to lat/lng via ST_Y/ST_X).
export class JobResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() ownerId: string;
  @ApiProperty({ nullable: true }) pickupLabel: string | null;
  @ApiProperty({ nullable: true }) pickupNotes: string | null;
  @ApiProperty() pickup: { lat: number; lng: number };
  @ApiProperty({ nullable: true }) dropOffLabel: string | null;
  @ApiProperty({ nullable: true }) dropOffNotes: string | null;
  @ApiProperty() dropOff: { lat: number; lng: number };
  @ApiProperty() cargoType: string;
  @ApiProperty({ enum: JobSize }) size: JobSize;
  @ApiProperty({ nullable: true }) weightKg: number | null;
  @ApiProperty() estimatedPrice: number;
  @ApiProperty() price: number;
  @ApiProperty({ enum: VehicleType }) reqVehicleType: VehicleType;
  @ApiProperty({ enum: JobStatus }) status: JobStatus;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ nullable: true }) postedAt: Date | null;
  @ApiProperty({ nullable: true }) matchedAt: Date | null;
  @ApiProperty({ nullable: true }) acceptedAt: Date | null;
  @ApiProperty({ nullable: true }) inProgressAt: Date | null;
  @ApiProperty({ nullable: true }) completedAt: Date | null;
  @ApiProperty({ nullable: true }) cancelledAt: Date | null;

  static fromRow(r: Record<string, unknown>): JobResponseDto {
    return {
      id: r.id as string,
      ownerId: r.ownerId as string,
      pickupLabel: (r.pickupLabel as string) ?? null,
      pickupNotes: (r.pickupNotes as string) ?? null,
      pickup: { lat: Number(r.pickupLat), lng: Number(r.pickupLng) },
      dropOffLabel: (r.dropOffLabel as string) ?? null,
      dropOffNotes: (r.dropOffNotes as string) ?? null,
      dropOff: { lat: Number(r.dropOffLat), lng: Number(r.dropOffLng) },
      cargoType: r.cargoType as string,
      size: r.size as JobSize,
      weightKg: r.weightKg != null ? Number(r.weightKg) : null,
      estimatedPrice: Number(r.estimatedPrice),
      price: Number(r.price),
      reqVehicleType: r.reqVehicleType as VehicleType,
      status: r.status as JobStatus,
      createdAt: r.createdAt as Date,
      postedAt: (r.postedAt as Date) ?? null,
      matchedAt: (r.matchedAt as Date) ?? null,
      acceptedAt: (r.acceptedAt as Date) ?? null,
      inProgressAt: (r.inProgressAt as Date) ?? null,
      completedAt: (r.completedAt as Date) ?? null,
      cancelledAt: (r.cancelledAt as Date) ?? null,
    };
  }
}
