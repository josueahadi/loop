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
import { StorageService } from '../storage/storage.service';
import { VerificationResponseDto } from '../verification/dto/verification-response.dto';
import { VerificationService } from '../verification/verification.service';
import { AdminDirectoryService } from './admin-directory.service';
import { AdminMetricsService } from './admin-metrics.service';
import { ListVerificationsQuery } from './dto/list-verifications.query';
import { ReviewVerificationDto } from './dto/review-verification.dto';

// All /admin/* routes are admin-only (RolesGuard runs globally after JwtAuthGuard).
@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly verification: VerificationService,
    private readonly directory: AdminDirectoryService,
    private readonly metrics: AdminMetricsService,
    private readonly storage: StorageService,
  ) {}

  // Server-computed evaluation metrics — the dashboard only renders these.
  @Get('metrics')
  getMetrics() {
    return this.metrics.getMetrics();
  }

  // Short-lived viewable URL for a verification document (signed when Firebase,
  // stub placeholder otherwise). Admin-only, like every /admin/* route.
  @Get('verifications/:id/document-url')
  async documentUrl(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ url: string | null; stub: boolean }> {
    const record = await this.verification.getRecord(id);
    return this.storage.signedUrl(record.storageReference);
  }

  @Get('verifications')
  async listVerifications(@Query() query: ListVerificationsQuery) {
    const status = query.status ?? VerificationStatus.PENDING;
    return this.directory.listVerifications(status);
  }

  @Get('drivers')
  async listDrivers() {
    return this.directory.listDrivers();
  }

  @Get('users')
  async listUsers() {
    return this.directory.listUsers();
  }

  @Get('jobs')
  async listJobs() {
    return this.directory.listJobs();
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
