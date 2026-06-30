import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, VerificationStatus } from '../../common/enums';
import { VerificationResponseDto } from '../verification/dto/verification-response.dto';
import { VerificationService } from '../verification/verification.service';
import { ListVerificationsQuery } from './dto/list-verifications.query';
import { ReviewVerificationDto } from './dto/review-verification.dto';

// All /admin/* routes are admin-only (RolesGuard runs globally after JwtAuthGuard).
@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly verification: VerificationService) {}

  @Get('verifications')
  async listVerifications(
    @Query() query: ListVerificationsQuery,
  ): Promise<VerificationResponseDto[]> {
    const status = query.status ?? VerificationStatus.PENDING;
    const records = await this.verification.listByStatus(status);
    return records.map(VerificationResponseDto.from);
  }

  @Patch('verifications/:id')
  async reviewVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewVerificationDto,
    @CurrentUser('id') adminId: string,
  ): Promise<VerificationResponseDto> {
    const record = await this.verification.review(id, dto.status, adminId);
    return VerificationResponseDto.from(record);
  }
}
