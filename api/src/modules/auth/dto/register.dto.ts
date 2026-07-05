import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../common/enums';

// Public signup. Only cargo_owner | driver — no admin self-signup.
export class RegisterDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+250780000000', description: 'E.164 Rwanda number' })
  @Matches(/^\+250\d{9}$/, {
    message: 'phone must be a valid +250 Rwanda number',
  })
  phone: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ enum: [UserRole.CARGO_OWNER, UserRole.DRIVER] })
  @IsEnum(UserRole)
  role: UserRole;
}
