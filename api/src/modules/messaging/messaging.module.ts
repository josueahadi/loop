import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { Proposal } from '../proposals/entities/proposal.entity';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { MessagesController } from './messages.controller';
import { MessagesUnreadController } from './messages-unread.controller';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';
import { MessagingAccessService } from './messaging-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageRead, Proposal, Job]),
    JwtModule.register({}),
  ],
  controllers: [MessagesController, MessagesUnreadController],
  providers: [MessagesService, MessagesGateway, MessagingAccessService],
})
export class MessagingModule {}
