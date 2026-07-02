import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as admin from 'firebase-admin';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// Best-effort push. A failed or unconfigured send NEVER throws to the caller —
// push is a delight, not a dependency, so the underlying action (proposal sent,
// message delivered) always succeeds. 'stub' driver just logs (dev, no creds).
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger('Push');
  private readonly driver: string;
  private ready = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    this.driver = this.config.get<string>('push.driver') ?? 'stub';
  }

  onModuleInit() {
    if (this.driver !== 'fcm') {
      this.logger.warn('PUSH_DRIVER=stub — notifications are logged, not sent');
      return;
    }
    try {
      if (!admin.apps.length) {
        const path = this.config.get<string>('storage.serviceAccountPath') ?? '';
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(fs.readFileSync(path, 'utf8'))),
        });
      }
      this.ready = true;
    } catch (err) {
      this.logger.error('FCM init failed — pushes will be skipped', err as Error);
    }
  }

  // Fire-and-forget; callers do not await success and are never affected by failure.
  async sendToUser(userId: string, msg: PushMessage): Promise<void> {
    try {
      if (this.driver !== 'fcm') {
        this.logger.log(`[stub push] to=${userId} "${msg.title}" — ${msg.body}`);
        return;
      }
      if (!this.ready) return;
      const user = await this.users.findOne({
        where: { id: userId },
        select: ['id', 'fcmToken'],
      });
      if (!user?.fcmToken) return; // no device registered — skip silently
      await admin.messaging().send({
        token: user.fcmToken,
        notification: { title: msg.title, body: msg.body },
        data: msg.data ?? {},
      });
    } catch (err) {
      this.logger.warn(`push to ${userId} failed (ignored): ${String(err)}`);
    }
  }
}
