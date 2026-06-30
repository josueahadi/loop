import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { VerificationStatus } from '../../../common/enums';

export class ListVerificationsQuery {
  @ApiPropertyOptional({ enum: VerificationStatus, default: VerificationStatus.PENDING })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;
}
