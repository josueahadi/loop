import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { NearbyDriverDto } from './dto/nearby-driver.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { MatchingService } from './matching.service';

// Owners search for nearby available drivers to send a proposal to.
@ApiTags('matching')
@ApiBearerAuth()
@Roles(UserRole.CARGO_OWNER)
@Controller('drivers')
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Get('nearby')
  findNearby(@Query() query: NearbyQueryDto): Promise<NearbyDriverDto[]> {
    return this.matching.findNearbyDrivers(query);
  }
}
