import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';

// Depends on PricingModule for the PostGIS great-circle fallback (distanceKm).
@Module({
  imports: [PricingModule],
  controllers: [RoutingController],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
