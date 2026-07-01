import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JobSize, VehicleType } from '../../common/enums';
import { EstimateDto, EstimateResponseDto } from './dto/estimate.dto';
import { PricingConfig } from './entities/pricing-config.entity';
import { SizeMultiplier } from './entities/size-multiplier.entity';

// Rule-based pricing (no ML). Reads base_fare / rate_per_km from pricing_config and
// size_factor from size_multipliers — no magic numbers. Distance is the PostGIS
// great-circle between the two pins (the same distance matching uses). RWF integer.
//   estimated_price = base_fare + ( rate_per_km × distance_km ) × size_factor
@Injectable()
export class PricingService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(PricingConfig)
    private readonly pricing: Repository<PricingConfig>,
    @InjectRepository(SizeMultiplier)
    private readonly sizeMultipliers: Repository<SizeMultiplier>,
  ) {}

  async distanceKm(
    pickup: { lat: number; lng: number },
    dropOff: { lat: number; lng: number },
  ): Promise<number> {
    const [{ meters }] = await this.dataSource.query(
      `SELECT ST_Distance(
                ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
                ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography
              ) AS meters`,
      [pickup.lat, pickup.lng, dropOff.lat, dropOff.lng],
    );
    return Number(meters) / 1000;
  }

  async computeEstimatedPrice(params: {
    vehicleType: VehicleType;
    size: JobSize;
    distanceKm: number;
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
      throw new BadRequestException(`No size multiplier for size ${params.size}`);
    }
    const sizeFactor = Number(sizeRow.multiplier);
    const raw =
      config.baseFare + config.ratePerKm * params.distanceKm * sizeFactor;
    return Math.round(raw); // whole RWF
  }

  async estimate(dto: EstimateDto): Promise<EstimateResponseDto> {
    const distanceKm = await this.distanceKm(dto.pickup, dto.drop_off);
    const estimatedPrice = await this.computeEstimatedPrice({
      vehicleType: dto.vehicle_type,
      size: dto.size,
      distanceKm,
    });
    return {
      estimated_price: estimatedPrice,
      distance_km: Math.round(distanceKm * 100) / 100,
    };
  }
}
