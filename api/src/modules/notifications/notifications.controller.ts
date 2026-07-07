import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // The caller's own notifications (newest first) + the unread count.
  @Get()
  async list(@CurrentUser('id') userId: string) {
    const [items, unread] = await Promise.all([
      this.notifications.listForUser(userId),
      this.notifications.unreadCount(userId),
    ]);
    return { unread, notifications: items };
  }

  @Get('unread-count')
  async unread(@CurrentUser('id') userId: string): Promise<{ count: number }> {
    return { count: await this.notifications.unreadCount(userId) };
  }

  @Patch('read-all')
  async readAll(
    @CurrentUser('id') userId: string,
  ): Promise<{ ok: true }> {
    await this.notifications.markAllRead(userId);
    return { ok: true };
  }

  @Patch(':id/read')
  async read(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    await this.notifications.markRead(userId, id);
    return { ok: true };
  }
}
