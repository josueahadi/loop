import { ApiProperty } from '@nestjs/swagger';
import { DocumentType, VerificationStatus } from '../../../common/enums';
import { VerificationRecord } from '../entities/verification-record.entity';

// Note: storageReference (a private object path) is intentionally NOT exposed to
// drivers. Admin review fetches files server-side via signed URLs (built later).
export class VerificationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() driverId: string;
  @ApiProperty({ enum: DocumentType }) documentType: DocumentType;
  @ApiProperty({ enum: VerificationStatus }) status: VerificationStatus;
  @ApiProperty({ nullable: true }) reviewedAt: Date | null;
  @ApiProperty({ nullable: true }) reviewNote: string | null;
  @ApiProperty() createdAt: Date;

  static from(r: VerificationRecord): VerificationResponseDto {
    return {
      id: r.id,
      driverId: r.driverId,
      documentType: r.documentType,
      status: r.status,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote,
      createdAt: r.createdAt,
    };
  }
}
