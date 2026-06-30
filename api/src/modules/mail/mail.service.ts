// One MailService interface, two implementations (SendGrid / console stub) selected by config.
export const MAIL_SERVICE = 'MAIL_SERVICE';

export interface MailService {
  sendPasswordReset(to: string, name: string, link: string): Promise<void>;
  sendEmailVerification(to: string, name: string, link: string): Promise<void>;
}
