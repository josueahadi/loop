import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser('id') id: string): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.users.getByIdOrFail(id));
  }

  @Patch('me')
  async updateMe(
    @CurrentUser('id') id: string,
    @Body() dto: UpdateMeDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.users.updateProfile(id, dto));
  }
}
