import { Module } from '@nestjs/common';
import { VerificationModule } from '../verification/verification.module';
import { AdminMetricsService } from './admin-metrics.service';
import { AdminController } from './admin.controller';

// Verification queue + document viewing + server-computed metrics (M6).
@Module({
  imports: [VerificationModule],
  controllers: [AdminController],
  providers: [AdminMetricsService],
})
export class AdminModule {}
