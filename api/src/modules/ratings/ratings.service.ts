import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { JobStatus, ProposalStatus } from '../../common/enums';
import { Job } from '../jobs/entities/job.entity';
import { Proposal } from '../proposals/entities/proposal.entity';
import { User } from '../users/entities/user.entity';
import { Rating } from './entities/rating.entity';
import { RatingResponseDto, UserRatingsDto } from './dto/rating-dtos';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating) private readonly ratings: Repository<Rating>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Proposal)
    private readonly proposals: Repository<Proposal>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // Data-layer enforced: only a participant of a COMPLETED job may rate, only the
  // counterparty, exactly once per direction. The aggregate is recomputed in the
  // same transaction as the insert.
  async create(
    userId: string,
    jobId: string,
    score: number,
    comment?: string,
  ): Promise<RatingResponseDto> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== JobStatus.COMPLETED) {
      throw new ForbiddenException(
        'You can only rate after the job is completed',
      );
    }

    // Participants = owner + the accepted driver.
    const accepted = await this.proposals.findOne({
      where: { jobId, status: ProposalStatus.ACCEPTED },
    });
    if (!accepted) throw new ForbiddenException('Job has no accepted driver');
    const participants = [job.ownerId, accepted.driverId];
    if (!participants.includes(userId)) {
      throw new ForbiddenException('Only the job participants can rate');
    }
    const toUserId = userId === job.ownerId ? accepted.driverId : job.ownerId;
    if (toUserId === userId) {
      throw new ForbiddenException('You cannot rate yourself');
    }

    try {
      return await this.ratings.manager.transaction(async (tx) => {
        const saved = await tx.save(
          tx.create(Rating, {
            jobId,
            fromUserId: userId,
            toUserId,
            score,
            comment: comment ?? null,
          }),
        );
        await this.recomputeAggregate(tx, toUserId);
        return RatingResponseDto.from(saved);
      });
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as any).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('You have already rated this job');
      }
      throw err;
    }
  }

  // Recompute AVG/COUNT over the ratee's received ratings — the reputation aggregate.
  private async recomputeAggregate(
    tx: EntityManager,
    toUserId: string,
  ): Promise<void> {
    const [{ avg, cnt }] = await tx.query(
      `SELECT COALESCE(AVG(score), 0) AS avg, COUNT(*) AS cnt
       FROM ratings WHERE to_user_id = $1`,
      [toUserId],
    );
    await tx.update(
      User,
      { id: toUserId },
      { averageRating: Number(avg), ratingCount: Number(cnt) },
    );
  }

  async forUser(userId: string): Promise<UserRatingsDto> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: ['id', 'averageRating', 'ratingCount'],
    });
    if (!user) throw new NotFoundException('User not found');
    const rows = await this.ratings.find({
      where: { toUserId: userId },
      order: { createdAt: 'DESC' },
      relations: { fromUser: true },
    });
    return {
      average: Number(user.averageRating),
      count: user.ratingCount,
      ratings: rows.map(RatingResponseDto.from),
    };
  }
}
