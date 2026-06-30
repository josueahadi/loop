import { Injectable, Logger } from '@nestjs/common';
import { MailService } from './mail.service';

// Dev driver: logs the action link to the console so auth flows work before
// SendGrid sender verification is complete (locked decision #2).
@Injectable()
export class StubMailService implements MailService {
  private readonly logger = new Logger('MailStub');

  async sendPasswordReset(to: string, name: string, link: string): Promise<void> {
    this.logger.log(`[password-reset] to=${to} (${name})\n  ${link}`);
  }

  async sendEmailVerification(to: string, name: string, link: string): Promise<void> {
    this.logger.log(`[email-verify] to=${to} (${name})\n  ${link}`);
  }
}
