import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, VerificationStatus } from '../../common/enums';
import { JobsService } from '../jobs/jobs.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { VerificationResponseDto } from '../verification/dto/verification-response.dto';
import { VerificationService } from '../verification/verification.service';
import { AdminDirectoryService } from './admin-directory.service';
import { AdminMetricsService } from './admin-metrics.service';
import { AuditService } from './audit.service';
import { DirectoryQuery } from './dto/directory-query.dto';
import { ListVerificationsQuery } from './dto/list-verifications.query';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';

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
    private readonly audit: AuditService,
    private readonly users: UsersService,
    private readonly jobs: JobsService,
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
  async listDrivers(@Query() query: DirectoryQuery) {
    return this.directory.listDrivers(query);
  }

  @Get('users')
  async listUsers(@Query() query: DirectoryQuery) {
    return this.directory.listUsers(query);
  }

  @Get('users/:id')
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.directory.getUserProfile(id);
  }

  @Get('jobs')
  async listJobs(@Query() query: DirectoryQuery) {
    return this.directory.listJobs(query);
  }

  @Get('jobs/:id')
  async getJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.directory.getJobDetail(id);
  }

  // Trail of admin actions (verification reviews, admin logins). Paginated;
  // `filter` narrows to a single action string (e.g. 'verification.rejected').
  @Get('audit')
  async listAudit(@Query() query: DirectoryQuery) {
    return this.audit.list(query);
  }

  @Patch('verifications/:id')
  async reviewVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewVerificationDto,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ): Promise<VerificationResponseDto> {
    const record = await this.verification.review(
      id,
      dto.status,
      adminId,
      dto.reviewNote,
    );
    await this.audit.record({
      actorId: adminId,
      action: `verification.${dto.status}`,
      targetType: 'verification_record',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
      metadata: { documentType: record.documentType, driverId: record.driverId },
    });
    return VerificationResponseDto.from(record);
  }

  // Re-open an already-decided verification record back to pending review.
  @Patch('verifications/:id/reopen')
  async reopenVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ): Promise<VerificationResponseDto> {
    const record = await this.verification.reopen(id);
    await this.audit.record({
      actorId: adminId,
      action: 'verification.reopened',
      targetType: 'verification_record',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
      metadata: { documentType: record.documentType, driverId: record.driverId },
    });
    return VerificationResponseDto.from(record);
  }

  // Force a driver offline (moderation lever; going online stays driver-only).
  @Patch('drivers/:id/offline')
  async forceDriverOffline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    await this.users.forceOffline(id);
    await this.audit.record({
      actorId: adminId,
      action: 'driver.forced_offline',
      targetType: 'user',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return this.directory.getUserProfile(id);
  }

  // Suspend or reactivate a user account (a suspended user cannot log in).
  @Patch('users/:id/suspension')
  async setUserSuspension(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendUserDto,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    await this.users.setSuspended(id, dto.suspended);
    await this.audit.record({
      actorId: adminId,
      action: dto.suspended ? 'user.suspended' : 'user.reactivated',
      targetType: 'user',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return this.directory.getUserProfile(id);
  }

  // Cancel any non-terminal job (an admin can resolve a stuck job).
  @Patch('jobs/:id/cancel')
  async cancelJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    const job = await this.jobs.adminCancel(id);
    await this.audit.record({
      actorId: adminId,
      action: 'job.cancelled',
      targetType: 'job',
      targetId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return job;
  }
}
