import { Module } from '@nestjs/common';
import { VerificationModule } from '../verification/verification.module';
import { AdminDirectoryService } from './admin-directory.service';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminController } from './admin.controller';

// Verification queue + document viewing + server-computed metrics (M6).
@Module({
  imports: [VerificationModule],
  controllers: [AdminController],
  providers: [AdminDirectoryService, AdminMetricsService],
})
export class AdminModule {}
