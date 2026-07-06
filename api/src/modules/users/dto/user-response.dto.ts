import { ApiProperty } from '@nestjs/swagger';
import { AvailabilityStatus, UserRole } from '../../../common/enums';
import { User } from '../entities/user.entity';

// Safe outward shape — never exposes password_hash.
export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() phone: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty({ nullable: true }) photoUrl: string | null;
  @ApiProperty() emailVerified: boolean;
  @ApiProperty({ enum: AvailabilityStatus, nullable: true })
  availabilityStatus: AvailabilityStatus | null;
  @ApiProperty({ nullable: true }) licenseNumber: string | null;
  @ApiProperty() averageRating: number;
  @ApiProperty() ratingCount: number;
  @ApiProperty() createdAt: Date;

  static from(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      photoUrl: user.photoUrl,
      emailVerified: user.emailVerifiedAt != null,
      availabilityStatus: user.availabilityStatus,
      licenseNumber: user.licenseNumber,
      averageRating: Number(user.averageRating),
      ratingCount: user.ratingCount,
      createdAt: user.createdAt,
    };
  }
}
