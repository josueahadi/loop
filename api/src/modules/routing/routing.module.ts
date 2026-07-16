import { Module } from '@nestjs/common';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';

// Uses the default DataSource for the PostGIS great-circle fallback; no domain
// module dependencies, so pricing can depend on routing without a cycle.
@Module({
  controllers: [RoutingController],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
