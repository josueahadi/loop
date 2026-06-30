import { Module } from '@nestjs/common';
import { VerificationModule } from '../verification/verification.module';
import { AdminController } from './admin.controller';

// M1: verification queue only. Metrics dashboard endpoints land in M6.
@Module({
  imports: [VerificationModule],
  controllers: [AdminController],
})
export class AdminModule {}
