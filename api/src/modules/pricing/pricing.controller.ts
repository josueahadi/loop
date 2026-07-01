import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { EstimateDto, EstimateResponseDto } from './dto/estimate.dto';
import { PricingService } from './pricing.service';

@ApiTags('pricing')
@ApiBearerAuth()
@Roles(UserRole.CARGO_OWNER)
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post('estimate')
  @HttpCode(200)
  estimate(@Body() dto: EstimateDto): Promise<EstimateResponseDto> {
    return this.pricing.estimate(dto);
  }
}
