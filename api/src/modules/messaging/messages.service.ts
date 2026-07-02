import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushService } from '../push/push.service';
import { Message } from './entities/message.entity';
import { MessageResponseDto } from './dto/message-response.dto';
import { MessagesGateway } from './messages.gateway';
import { MessagingAccessService } from './messaging-access.service';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    private readonly access: MessagingAccessService,
    private readonly gateway: MessagesGateway,
    private readonly push: PushService,
  ) {}

  // Participant-gated: throws 403 if the thread isn't open or the user isn't in it.
  async list(userId: string, jobId: string): Promise<MessageResponseDto[]> {
    await this.access.assertParticipant(userId, jobId);
    const rows = await this.messages.find({
      where: { jobId },
      order: { sentAt: 'ASC' },
    });
    return rows.map(MessageResponseDto.from);
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
