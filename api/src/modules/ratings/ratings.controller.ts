import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateRatingDto,
  RatingResponseDto,
  UserRatingsDto,
} from './dto/rating-dtos';
import { RatingsService } from './ratings.service';

// Any signed-in user; the service enforces the participant / completed / one-per
// gates. Both directions are allowed (owner↔driver), one each per job.
@ApiTags('ratings')
@ApiBearerAuth()
@Controller()
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Post('jobs/:jobId/ratings')
  create(
    @CurrentUser('id') userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: CreateRatingDto,
  ): Promise<RatingResponseDto> {
    return this.ratings.create(userId, jobId, dto.score, dto.comment);
  }

  @Get('users/:id/ratings')
  forUser(@Param('id', ParseUUIDPipe) id: string): Promise<UserRatingsDto> {
    return this.ratings.forUser(id);
  }
}
