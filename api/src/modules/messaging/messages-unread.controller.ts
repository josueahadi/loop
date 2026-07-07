import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';

// Cross-job unread counts (not scoped to one job) so job cards can badge.
@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesUnreadController {
  constructor(private readonly messages: MessagesService) {}

  // { [jobId]: unreadCount } for the caller — jobs with no unread are omitted.
  @Get('unread')
  unread(
    @CurrentUser('id') userId: string,
  ): Promise<Record<string, number>> {
    return this.messages.unreadByJob(userId);
  }
}
