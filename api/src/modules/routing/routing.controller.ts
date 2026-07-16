import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RouteQueryDto, RouteResponseDto } from './dto/routing.dto';
import { RoutingService } from './routing.service';

// Any signed-in user may request a route. OSM-derived — clients must show
// "© OpenStreetMap contributors" where a route is displayed.
@ApiTags('routing')
@ApiBearerAuth()
@Controller('routing')
export class RoutingController {
  constructor(private readonly routing: RoutingService) {}

  @Get('route')
  @ApiOperation({
    summary:
      'Road route between two points (OSRM), with a great-circle fallback when OSRM is unreachable',
  })
  route(@Query() q: RouteQueryDto): Promise<RouteResponseDto> {
    return this.routing.route(
      { lat: q.from_lat, lng: q.from_lng },
      { lat: q.to_lat, lng: q.to_lng },
      q.steps ?? false,
    );
  }
}
