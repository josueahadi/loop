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
import {
  CreateProposalDto,
  ProposalResponseDto,
  RespondProposalDto,
} from './dto/proposal-dtos';
import { ProposalsService } from './proposals.service';

// Owner sends proposals on their own job and reviews responses.
@ApiTags('proposals')
@ApiBearerAuth()
@Roles(UserRole.CARGO_OWNER)
@Controller('jobs/:jobId/proposals')
export class JobProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Post()
  create(
    @CurrentUser('id') ownerId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: CreateProposalDto,
  ): Promise<ProposalResponseDto> {
    return this.proposals.create(ownerId, jobId, dto.driverId);
  }

  @Get()
  list(
    @CurrentUser('id') ownerId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<ProposalResponseDto[]> {
    return this.proposals.listForOwnerJob(ownerId, jobId);
  }
}

// Driver reviews incoming proposals and accepts / declines.
@ApiTags('proposals')
@ApiBearerAuth()
@Roles(UserRole.DRIVER)
@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Get()
  incoming(
    @CurrentUser('id') driverId: string,
  ): Promise<ProposalResponseDto[]> {
    return this.proposals.listForDriver(driverId);
  }

  @Patch(':id')
  respond(
    @CurrentUser('id') driverId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondProposalDto,
  ): Promise<ProposalResponseDto> {
    return this.proposals.respond(driverId, id, dto.status);
  }
}
