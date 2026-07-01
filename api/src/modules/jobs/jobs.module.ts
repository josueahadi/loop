import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

// Uses the shared DataSource directly for raw PostGIS-aware queries.
@Module({
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
