import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { StorageService } from '../storage/storage.service';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly storage: StorageService,
  ) {}

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

  // Driver online/offline toggle + current location (M2 matching).
  @Roles(UserRole.DRIVER)
  @Patch('me/availability')
  async updateAvailability(
    @CurrentUser('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ): Promise<UserResponseDto> {
    const user = await this.users.updateAvailability(
      id,
      dto.status,
      dto.lat,
      dto.lng,
    );
    return UserResponseDto.from(user);
  }

  // Profile photo: API-mediated upload to private Storage; only the reference is
  // stored on the user (photo_url).
  @Post('me/photo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @CurrentUser('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UserResponseDto> {
    if (!file) throw new BadRequestException('A photo file is required');
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG or PNG photos are allowed');
    }
    const objectPath = `profile-photos/${id}-${Date.now()}`;
    const { storageReference } = await this.storage.upload(
      objectPath,
      file.buffer,
      file.mimetype,
    );
    return UserResponseDto.from(await this.users.setPhotoUrl(id, storageReference));
  }
}
