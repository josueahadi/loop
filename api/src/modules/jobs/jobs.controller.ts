import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { CreateJobDto } from './dto/create-job.dto';
import { JobResponseDto } from './dto/job-response.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { JobsService } from './jobs.service';

// Jobs are owner-owned. Proposals/matching update job status from M4.
@ApiTags('jobs')
@ApiBearerAuth()
@Roles(UserRole.CARGO_OWNER)
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  create(
    @CurrentUser('id') ownerId: string,
    @Body() dto: CreateJobDto,
  ): Promise<JobResponseDto> {
    return this.jobs.create(ownerId, dto);
  }

  @Get()
  list(@CurrentUser('id') ownerId: string): Promise<JobResponseDto[]> {
    return this.jobs.listForOwner(ownerId);
  }

  @Get(':id')
  get(
    @CurrentUser('id') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<JobResponseDto> {
    return this.jobs.getOwned(id, ownerId);
  }

  @Patch(':id')
  updateStatus(
    @CurrentUser('id') ownerId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobStatusDto,
  ): Promise<JobResponseDto> {
    return this.jobs.updateStatus(id, ownerId, dto.status);
  }
}
