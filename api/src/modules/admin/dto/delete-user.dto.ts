import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

// Admin account deletion. When [blocklist] is true (e.g. removal for false
// documents), a hashed record of the email/phone is kept so the same identifiers
// cannot immediately re-register; [reason] is recorded with it and in the audit
// log.
export class DeleteUserDto {
  @ApiPropertyOptional({
    description: 'Retain a hashed anti-re-registration record (fraud removal).',
  })
  @IsOptional()
  @IsBoolean()
  blocklist?: boolean;

  @ApiPropertyOptional({ description: 'Reason for the deletion (audited).' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
