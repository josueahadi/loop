import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  MessageResponseDto,
  SendMessageDto,
} from './dto/message-response.dto';
import { MessagesService } from './messages.service';

// Any signed-in user; the service enforces the participant gate (owner + accepted
// driver only, and only after acceptance). GET is the polling fallback for the WS.
@ApiTags('messages')
@ApiBearerAuth()
@Controller('jobs/:jobId/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<MessageResponseDto[]> {
    return this.messages.list(userId, jobId);
  }

  @Post()
  send(
    @CurrentUser('id') userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messages.send(userId, jobId, dto.content);
  }
}
