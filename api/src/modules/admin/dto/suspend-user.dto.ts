import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SuspendUserDto {
  @ApiProperty({ description: 'true to suspend, false to reactivate' })
  @IsBoolean()
  suspended: boolean;
}
