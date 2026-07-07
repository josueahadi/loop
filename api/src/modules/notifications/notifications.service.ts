import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
  ) {}

  // Persist a notification. Best-effort — a write failure must never break the
  // underlying action (the caller is the push send).
  async record(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      await this.notifications.insert({
        userId,
        title,
        body,
        data: data ?? null,
      });
    } catch (err) {
      this.logger.warn(`notification write failed (ignored): ${String(err)}`);
    }
  }

  listForUser(userId: string, limit = 50): Promise<Notification[]> {
    return this.notifications.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notifications.count({
      where: { userId, readAt: IsNull() },
    });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.notifications.update(
      { id, userId, readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifications.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
  }
}
