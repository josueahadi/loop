import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

// Real driver: Africa's Talking (Rwanda-supported SMS). Uses the REST API via
// fetch — no SDK dependency. Credentials are read lazily so this provider can be
// constructed even under SMS_DRIVER=stub. Never throws into the caller.
@Injectable()
export class AfricasTalkingSmsService implements SmsService {
  private readonly logger = new Logger('SmsAfricasTalking');
  private static readonly url =
    'https://api.africastalking.com/version1/messaging';

  constructor(private readonly config: ConfigService) {}

  async send(to: string, message: string): Promise<void> {
    const username = this.config.get<string>('sms.username') ?? '';
    const apiKey = this.config.get<string>('sms.apiKey') ?? '';
    const from = this.config.get<string>('sms.senderId') ?? '';
    if (!username || !apiKey) {
      this.logger.warn(`SMS not sent to ${to}: credentials not configured`);
      return;
    }
    try {
      const body = new URLSearchParams({
        username,
        to,
        message,
        ...(from ? { from } : {}),
      });
      const res = await fetch(AfricasTalkingSmsService.url, {
        method: 'POST',
        headers: {
          apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body,
      });
      if (!res.ok) {
        this.logger.warn(`SMS to ${to} failed: HTTP ${res.status}`);
      }
    } catch (err) {
      // Best-effort — a delight, not a dependency.
      this.logger.warn(`SMS to ${to} failed (ignored): ${String(err)}`);
    }
  }
}
