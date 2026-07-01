import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  GeocodeResultDto,
  ReverseQueryDto,
  ReverseResultDto,
  SearchQueryDto,
} from './dto/geocode.dto';
import { GeocodeService } from './geocode.service';

// Any signed-in user may geocode. Results are OSM-licensed — clients must show
// "© OpenStreetMap contributors" where they appear.
@ApiTags('geocode')
@ApiBearerAuth()
@Controller('geocode')
export class GeocodeController {
  constructor(private readonly geocode: GeocodeService) {}

  @Get('search')
  search(@Query() q: SearchQueryDto): Promise<GeocodeResultDto[]> {
    return this.geocode.search(q.q, q.limit ?? 5);
  }

  @Get('reverse')
  reverse(@Query() q: ReverseQueryDto): Promise<ReverseResultDto> {
    return this.geocode.reverse(q.lat, q.lng);
  }
}
