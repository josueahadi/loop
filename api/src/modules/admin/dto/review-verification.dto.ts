import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { VerificationStatus } from '../../../common/enums';

export class ReviewVerificationDto {
  @ApiProperty({
    enum: [VerificationStatus.APPROVED, VerificationStatus.REJECTED],
  })
  @IsIn([VerificationStatus.APPROVED, VerificationStatus.REJECTED])
  status: VerificationStatus.APPROVED | VerificationStatus.REJECTED;

  // Reason shown to the driver on rejection. Optional (reject without a note is
  // still allowed) and ignored on approval.
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
