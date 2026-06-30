import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { VerificationStatus } from '../../../common/enums';

export class ReviewVerificationDto {
  @ApiProperty({ enum: [VerificationStatus.APPROVED, VerificationStatus.REJECTED] })
  @IsIn([VerificationStatus.APPROVED, VerificationStatus.REJECTED])
  status: VerificationStatus.APPROVED | VerificationStatus.REJECTED;
}
