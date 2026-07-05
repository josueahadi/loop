import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProposalStatus } from '../../common/enums';
import { Job } from '../jobs/entities/job.entity';
import { Proposal } from '../proposals/entities/proposal.entity';

export interface Participants {
  ownerId: string;
  driverId: string;
}

// The chat gate — mirrors the contact gate. A thread exists ONLY once a proposal
// is accepted, and only the two participants (owner + accepted driver) may access
// it. Enforced server-side for both REST and WebSocket.
@Injectable()
export class MessagingAccessService {
  constructor(
    @InjectRepository(Proposal)
    private readonly proposals: Repository<Proposal>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
  ) {}

  // Returns the two participants, or throws if the thread isn't open yet.
  async participants(jobId: string): Promise<Participants> {
    const accepted = await this.proposals.findOne({
      where: { jobId, status: ProposalStatus.ACCEPTED },
    });
    if (!accepted) {
      throw new ForbiddenException('Chat opens after a proposal is accepted');
    }
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new ForbiddenException('Job not found');
    return { ownerId: job.ownerId, driverId: accepted.driverId };
  }

  async assertParticipant(
    userId: string,
    jobId: string,
  ): Promise<Participants> {
    const p = await this.participants(jobId);
    if (userId !== p.ownerId && userId !== p.driverId) {
      throw new ForbiddenException('Not a participant of this job');
    }
    return p;
  }

  otherParty(userId: string, p: Participants): string {
    return userId === p.ownerId ? p.driverId : p.ownerId;
  }
}
