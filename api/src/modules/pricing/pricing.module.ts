import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutingModule } from '../routing/routing.module';
import { PricingConfig } from './entities/pricing-config.entity';
import { SizeMultiplier } from './entities/size-multiplier.entity';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PricingConfig, SizeMultiplier]),
    RoutingModule,
  ],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
