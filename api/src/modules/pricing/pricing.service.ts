import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobSize, VehicleType } from '../../common/enums';
import { RoutingService } from '../routing/routing.service';
import { EstimateDto, EstimateResponseDto } from './dto/estimate.dto';
import { PricingConfig } from './entities/pricing-config.entity';
import { SizeMultiplier } from './entities/size-multiplier.entity';

// Rule-based pricing v2 (no ML). Reads base_fare / rate_per_km / rate_per_min /
// min_fare from pricing_config and size_factor from size_multipliers — no magic
// numbers. Road distance + duration come from the routing (OSRM) proxy, with the
// PostGIS great-circle as the fallback. RWF integer.
//   estimated_price = max( min_fare,
//                          base_fare + rate_per_km × km + rate_per_min × min )
//                     × size_factor
// The time term is omitted when duration is unknown (great-circle fallback).
@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PricingConfig)
    private readonly pricing: Repository<PricingConfig>,
    @InjectRepository(SizeMultiplier)
    private readonly sizeMultipliers: Repository<SizeMultiplier>,
    private readonly routing: RoutingService,
  ) {}

  async computeEstimatedPrice(params: {
    vehicleType: VehicleType;
    size: JobSize;
    distanceKm: number;
    // Omit (or null) on the great-circle fallback: the time term is then dropped.
    durationMin?: number | null;
  }): Promise<number> {
    const config = await this.pricing.findOne({
      where: { vehicleType: params.vehicleType },
    });
    if (!config) {
      throw new BadRequestException(
        `No pricing configured for vehicle type ${params.vehicleType}`,
      );
    }
    const sizeRow = await this.sizeMultipliers.findOne({
      where: { size: params.size },
    });
    if (!sizeRow) {
      throw new BadRequestException(
        `No size multiplier for size ${params.size}`,
      );
    }
    const sizeFactor = Number(sizeRow.multiplier);

    const distanceTerm = config.ratePerKm * params.distanceKm;
    const timeTerm =
      params.durationMin != null ? config.ratePerMin * params.durationMin : 0;
    const variable = config.baseFare + distanceTerm + timeTerm;
    // min_fare is a floor inside the max, so size_factor scales the floor too.
    const raw = Math.max(config.minFare, variable) * sizeFactor;
    return Math.round(raw); // whole RWF
  }

  async estimate(dto: EstimateDto): Promise<EstimateResponseDto> {
    // Road distance + duration from OSRM; falls back to great-circle (duration
    // null) inside the routing service, flagged via distance_source.
    const route = await this.routing.route(dto.pickup, dto.drop_off, false);
    const estimatedPrice = await this.computeEstimatedPrice({
      vehicleType: dto.vehicle_type,
      size: dto.size,
      distanceKm: route.distance_km,
      durationMin: route.duration_min,
    });
    return {
      estimated_price: estimatedPrice,
      distance_km: route.distance_km,
      duration_min: route.duration_min,
      distance_source: route.distance_source,
    };
  }
}
