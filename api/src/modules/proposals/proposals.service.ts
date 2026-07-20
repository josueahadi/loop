import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JobStatus, ProposalStatus, UserRole } from '../../common/enums';
import { Job } from '../jobs/entities/job.entity';
import { PushService } from '../push/push.service';
import { User } from '../users/entities/user.entity';
import {
  ContactDto,
  ProposalJobDto,
  ProposalResponseDto,
} from './dto/proposal-dtos';
import { Proposal } from './entities/proposal.entity';

@Injectable()
export class ProposalsService {
  constructor(
    @InjectRepository(Proposal)
    private readonly proposals: Repository<Proposal>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly push: PushService,
  ) {}

  // Owner sends a proposal to a driver, at the job's posted price. Only while the
  // job is still open (posted); no duplicate live proposal to the same driver.
  async create(
    ownerId: string,
    jobId: string,
    driverId: string,
  ): Promise<ProposalResponseDto> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.ownerId !== ownerId) {
      throw new NotFoundException('Job not found');
    }
    if (job.status !== JobStatus.POSTED) {
      throw new ConflictException('Job is not open for proposals');
    }
    const driver = await this.users.findOne({ where: { id: driverId } });
    if (!driver || driver.role !== UserRole.DRIVER) {
      throw new BadRequestException('Target is not a driver');
    }
    const existing = await this.proposals.findOne({
      where: {
        jobId,
        driverId,
        status: In([ProposalStatus.SENT, ProposalStatus.ACCEPTED]),
      },
    });
    if (existing) {
      throw new ConflictException(
        'A live proposal already exists for this driver',
      );
    }
    const saved = await this.proposals.save(
      this.proposals.create({ jobId, driverId, status: ProposalStatus.SENT }),
    );
    void this.push.sendToUser(driverId, {
      title: 'New job proposal',
      body: `${job.cargoType} · ${job.price ?? 0} RWF`,
      data: { type: 'proposal', jobId, proposalId: saved.id },
    });
    const coords = (await this.coordsFor([jobId])).get(jobId);
    return this.toDto(saved, { job, coords });
  }

  // Driver's incoming proposals, newest first. Owner contact is attached ONLY on
  // accepted proposals — never before.
  async listForDriver(driverId: string): Promise<ProposalResponseDto[]> {
    const rows = await this.proposals.find({
      where: { driverId },
      relations: ['job', 'job.owner'],
      order: { createdAt: 'DESC' },
    });
    const coords = await this.coordsFor(rows.map((r) => r.jobId));
    return rows.map((p) =>
      this.toDto(p, {
        job: p.job,
        coords: coords.get(p.jobId),
        contact:
          p.status === ProposalStatus.ACCEPTED ? contactOf(p.job.owner) : null,
      }),
    );
  }

  // Proposals on the owner's own job — driver contact attached only once accepted.
  async listForOwnerJob(
    ownerId: string,
    jobId: string,
  ): Promise<ProposalResponseDto[]> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.ownerId !== ownerId) {
      throw new NotFoundException('Job not found');
    }
    const rows = await this.proposals.find({
      where: { jobId },
      relations: ['driver'],
      order: { createdAt: 'DESC' },
    });
    return rows.map((p) =>
      this.toDto(p, {
        contact:
          p.status === ProposalStatus.ACCEPTED ? contactOf(p.driver) : null,
      }),
    );
  }

  // Driver accepts or declines. Accepting matches the job, auto-declines the other
  // pending proposals, and reveals the owner's contact. Exactly one accepted per job.
  async respond(
    driverId: string,
    proposalId: string,
    status: ProposalStatus.ACCEPTED | ProposalStatus.DECLINED,
  ): Promise<ProposalResponseDto> {
    const proposal = await this.proposals.findOne({
      where: { id: proposalId },
      relations: ['job', 'job.owner'],
    });
    if (!proposal || proposal.driverId !== driverId) {
      throw new NotFoundException('Proposal not found');
    }
    if (proposal.status !== ProposalStatus.SENT) {
      if (proposal.status === status) {
        const coords = (await this.coordsFor([proposal.jobId])).get(
          proposal.jobId,
        );
        return this.toDto(proposal, {
          job: proposal.job,
          coords,
          contact:
            proposal.status === ProposalStatus.ACCEPTED
              ? contactOf(proposal.job.owner)
              : null,
        });
      }
      throw new ConflictException('Proposal has already been responded to');
    }

    if (status === ProposalStatus.DECLINED) {
      proposal.status = ProposalStatus.DECLINED;
      proposal.respondedAt = new Date();
      await this.proposals.save(proposal);
      void this.push.sendToUser(proposal.job.ownerId, {
        title: 'Proposal declined',
        body: 'A driver declined your proposal.',
        data: { type: 'proposal_declined', jobId: proposal.jobId },
      });
      const coords = (await this.coordsFor([proposal.jobId])).get(
        proposal.jobId,
      );
      return this.toDto(proposal, { job: proposal.job, coords });
    }

    // Accept — the job must still be open (no other accepted proposal).
    if (proposal.job.status !== JobStatus.POSTED) {
      throw new ConflictException('Job has already been matched');
    }
    await this.proposals.manager.transaction(async (tx) => {
      const now = new Date();
      await tx.update(
        Proposal,
        { id: proposal.id },
        { status: ProposalStatus.ACCEPTED, respondedAt: now },
      );
      await tx.update(
        Job,
        { id: proposal.jobId, status: JobStatus.POSTED },
        { status: JobStatus.MATCHED, matchedAt: now, acceptedAt: now },
      );
      // Auto-decline the other still-pending proposals for this job.
      await tx.update(
        Proposal,
        {
          jobId: proposal.jobId,
          status: ProposalStatus.SENT,
        },
        { status: ProposalStatus.DECLINED, respondedAt: now },
      );
    });
    proposal.status = ProposalStatus.ACCEPTED;
    proposal.respondedAt = new Date();
    proposal.job.status = JobStatus.MATCHED;
    proposal.job.matchedAt = proposal.respondedAt;
    proposal.job.acceptedAt = proposal.respondedAt;
    void this.push.sendToUser(proposal.job.ownerId, {
      title: 'Proposal accepted',
      body: 'A driver accepted — you can now chat and share contact.',
      data: { type: 'proposal_accepted', jobId: proposal.jobId },
    });
    const coords = (await this.coordsFor([proposal.jobId])).get(proposal.jobId);
    return this.toDto(proposal, {
      job: proposal.job,
      coords,
      contact: contactOf(proposal.job.owner),
    });
  }

  // Pickup/drop-off lat-lng for the given jobs (geography → ST_X/ST_Y), batched.
  private async coordsFor(jobIds: string[]): Promise<Map<string, JobCoords>> {
    const map = new Map<string, JobCoords>();
    if (jobIds.length === 0) return map;
    const rows = await this.jobs.manager.query(
      `SELECT id,
              ST_Y(pickup_location::geometry) AS "pLat",
              ST_X(pickup_location::geometry) AS "pLng",
              ST_Y(drop_off_location::geometry) AS "dLat",
              ST_X(drop_off_location::geometry) AS "dLng"
       FROM jobs WHERE id = ANY($1)`,
      [jobIds],
    );
    for (const r of rows) {
      map.set(r.id, {
        pickup: { lat: Number(r.pLat), lng: Number(r.pLng) },
        dropOff: { lat: Number(r.dLat), lng: Number(r.dLng) },
      });
    }
    return map;
  }

  private toDto(
    p: Proposal,
    extra: { job?: Job; coords?: JobCoords; contact?: ContactDto | null } = {},
  ): ProposalResponseDto {
    return {
      id: p.id,
      jobId: p.jobId,
      driverId: p.driverId,
      status: p.status,
      createdAt: p.createdAt,
      respondedAt: p.respondedAt,
      job: extra.job ? jobSummary(extra.job, extra.coords) : undefined,
      contact: extra.contact ?? null,
    };
  }
}

interface JobCoords {
  pickup: { lat: number; lng: number };
  dropOff: { lat: number; lng: number };
}

function contactOf(u: User): ContactDto {
  return { name: u.name, phone: u.phone };
}

function jobSummary(j: Job, coords?: JobCoords): ProposalJobDto {
  return {
    id: j.id,
    cargoType: j.cargoType,
    pickupLabel: j.pickupLabel,
    dropOffLabel: j.dropOffLabel,
    pickup: coords?.pickup ?? { lat: 0, lng: 0 },
    dropOff: coords?.dropOff ?? { lat: 0, lng: 0 },
    price: j.price ?? 0,
    estimatedPrice: j.estimatedPrice ?? null,
    reqVehicleType: j.reqVehicleType,
    status: j.status,
  };
}
