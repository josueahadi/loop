import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// Profile edit. No business-credential fields (out of scope). Email/role/password are
// not editable here — those go through dedicated auth flows.
export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '+250780000000' })
  @IsOptional()
  @Matches(/^\+250\d{9}$/, {
    message: 'phone must be a valid +250 Rwanda number',
  })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoUrl?: string;
}
