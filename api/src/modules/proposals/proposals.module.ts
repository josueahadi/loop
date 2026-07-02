import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { User } from '../users/entities/user.entity';
import { Proposal } from './entities/proposal.entity';
import {
  JobProposalsController,
  ProposalsController,
} from './proposals.controller';
import { ProposalsService } from './proposals.service';

@Module({
  imports: [TypeOrmModule.forFeature([Proposal, Job, User])],
  controllers: [JobProposalsController, ProposalsController],
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class ProposalsModule {}
