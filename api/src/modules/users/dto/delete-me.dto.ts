import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// Self-serve account deletion requires re-entering the password — a destructive,
// irreversible action must be confirmed by proof of identity, not just a session.
export class DeleteMeDto {
  @ApiProperty({ description: 'Current password, to confirm the deletion.' })
  @IsString()
  @MinLength(1)
  password: string;
}
