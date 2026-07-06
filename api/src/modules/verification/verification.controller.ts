import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { VerificationResponseDto } from './dto/verification-response.dto';
import { VerificationService } from './verification.service';

// Drivers only — cargo owners are never verified.
@ApiTags('verification')
@ApiBearerAuth()
@Roles(UserRole.DRIVER)
@Controller('verification')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async submit(
    @CurrentUser('id') driverId: string,
    @Body() dto: CreateVerificationDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<VerificationResponseDto> {
    const record = await this.verification.submit(
      driverId,
      dto.documentType,
      file,
    );
    return VerificationResponseDto.from(record);
  }

  @Get()
  async listOwn(
    @CurrentUser('id') driverId: string,
  ): Promise<VerificationResponseDto[]> {
    const records = await this.verification.listOwn(driverId);
    return records.map(VerificationResponseDto.from);
  }

  // Short-lived signed URL so a driver can preview their OWN uploaded document.
  @Get(':id/document-url')
  async documentUrl(
    @CurrentUser('id') driverId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ url: string | null; stub: boolean }> {
    return this.verification.ownDocumentUrl(driverId, id);
  }
}
