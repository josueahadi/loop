import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import { MailService } from './mail.service';

@Injectable()
export class SendgridMailService implements MailService {
  private readonly logger = new Logger('MailSendGrid');
  private readonly from: string;
  private readonly fromName: string;
  private keyConfigured = false;

  constructor(private readonly config: ConfigService) {
    // Key is set lazily on first send so this provider can be constructed even
    // when MAIL_DRIVER=stub (no API key present).
    this.from = this.config.get<string>('mail.from') ?? 'no-reply@loop.rw';
    this.fromName = this.config.get<string>('mail.fromName') ?? 'Loop';
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.keyConfigured) {
      sgMail.setApiKey(this.config.get<string>('mail.sendgridApiKey') ?? '');
      this.keyConfigured = true;
    }
    try {
      await sgMail.send({
        to,
        from: { email: this.from, name: this.fromName },
        subject,
        html,
      });
    } catch (err) {
      this.logger.error(`Failed to send "${subject}" to ${to}`, err as Error);
      throw err;
    }
  }

  async sendPasswordReset(
    to: string,
    name: string,
    link: string,
  ): Promise<void> {
    await this.send(
      to,
      'Reset your Loop password',
      `<p>Hi ${name},</p><p>Reset your password using the link below (valid for a limited time):</p><p><a href="${link}">Reset password</a></p>`,
    );
  }

  async sendEmailVerification(
    to: string,
    name: string,
    link: string,
  ): Promise<void> {
    await this.send(
      to,
      'Verify your Loop email',
      `<p>Hi ${name},</p><p>Confirm your email address:</p><p><a href="${link}">Verify email</a></p>`,
    );
  }
}
