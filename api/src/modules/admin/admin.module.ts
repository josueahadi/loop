import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationModule } from '../verification/verification.module';
import { AdminDirectoryService } from './admin-directory.service';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminController } from './admin.controller';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

// Verification queue + document viewing + server-computed metrics + audit trail.
@Module({
  imports: [VerificationModule, TypeOrmModule.forFeature([AuditLog])],
  controllers: [AdminController],
  providers: [AdminDirectoryService, AdminMetricsService, AuditService],
  exports: [AuditService],
})
export class AdminModule {}
