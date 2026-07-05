import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsLatitude, IsLongitude, ValidateIf } from 'class-validator';
import { AvailabilityStatus } from '../../../common/enums';

// Driver online/offline toggle + current location. When going online, lat/lng are
// required so the driver can be matched; when going offline they are optional.
export class UpdateAvailabilityDto {
  @ApiProperty({ enum: AvailabilityStatus })
  @IsEnum(AvailabilityStatus)
  status: AvailabilityStatus;

  @ApiPropertyOptional({ example: -1.9441 })
  @ValidateIf((o) => o.status === AvailabilityStatus.ONLINE || o.lat != null)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: 30.0619 })
  @ValidateIf((o) => o.status === AvailabilityStatus.ONLINE || o.lng != null)
  @IsLongitude()
  lng?: number;
}
