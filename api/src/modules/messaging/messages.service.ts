import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PushService } from '../push/push.service';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { MessageResponseDto } from './dto/message-response.dto';
import { MessagesGateway } from './messages.gateway';
import { MessagingAccessService } from './messaging-access.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    @InjectRepository(MessageRead)
    private readonly reads: Repository<MessageRead>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly access: MessagingAccessService,
    private readonly gateway: MessagesGateway,
    private readonly push: PushService,
  ) {}

  // Participant-gated: throws 403 if the thread isn't open or the user isn't in it.
  // Listing a thread marks it read for the caller (they're looking at it now).
  async list(userId: string, jobId: string): Promise<MessageResponseDto[]> {
    await this.access.assertParticipant(userId, jobId);
    const rows = await this.messages.find({
      where: { jobId },
      order: { sentAt: 'ASC' },
    });
    await this.markRead(userId, jobId);
    return rows.map(MessageResponseDto.from);
  }

  // Upsert the read marker to "now" for this user+job.
  async markRead(userId: string, jobId: string): Promise<void> {
    await this.reads
      .createQueryBuilder()
      .insert()
      .into(MessageRead)
      .values({ userId, jobId, lastReadAt: () => 'now()' })
      .orUpdate(['last_read_at'], ['user_id', 'job_id'])
      .execute();
  }

  // Unread counts per job for a user: messages the OTHER party sent after the
  // user's last_read_at (or all inbound messages if they've never opened it).
  async unreadByJob(userId: string): Promise<Record<string, number>> {
    const rows: { jobId: string; count: number }[] = await this.ds.query(
      `SELECT m.job_id AS "jobId", COUNT(*)::int AS count
       FROM messages m
       LEFT JOIN message_reads r
         ON r.user_id = $1 AND r.job_id = m.job_id
       WHERE m.receiver_id = $1
         AND (r.last_read_at IS NULL OR m.sent_at > r.last_read_at)
       GROUP BY m.job_id`,
      [userId],
    );
    const map: Record<string, number> = {};
    for (const r of rows) map[r.jobId] = r.count;
    return map;
  }

  async send(
    userId: string,
    jobId: string,
    content: string,
  ): Promise<MessageResponseDto> {
    const participants = await this.access.assertParticipant(userId, jobId);
    const receiverId = this.access.otherParty(userId, participants);
    const saved = await this.messages.save(
      this.messages.create({ jobId, senderId: userId, receiverId, content }),
    );
    const dto = MessageResponseDto.from(saved);
    this.gateway.broadcast(jobId, dto); // live delivery to the job room
    void this.push.sendToUser(receiverId, {
      title: 'New message',
      body: content.length > 80 ? `${content.slice(0, 77)}…` : content,
      data: { type: 'message', jobId },
    });
    return dto;
  }
}
