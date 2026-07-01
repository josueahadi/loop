import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

// Uses the shared DataSource directly for raw PostGIS queries.
@Module({
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
