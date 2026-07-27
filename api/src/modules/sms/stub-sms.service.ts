import { Injectable, Logger } from '@nestjs/common';
import { SmsService } from './sms.service';

// Dev driver: logs the SMS to the console so notification flows work with no
// provider credentials. This is what runs under SMS_DRIVER=stub (the default).
@Injectable()
export class StubSmsService implements SmsService {
  private readonly logger = new Logger('SmsStub');

  async send(to: string, message: string): Promise<void> {
    this.logger.log(`[stub sms] to=${to}\n  ${message}`);
  }
}
