import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_SERVICE } from './mail.service';
import { SendgridMailService } from './sendgrid-mail.service';
import { StubMailService } from './stub-mail.service';

// Global so any module can inject MAIL_SERVICE. Driver chosen by MAIL_DRIVER env.
@Global()
@Module({
  providers: [
    StubMailService,
    SendgridMailService,
    {
      provide: MAIL_SERVICE,
      inject: [ConfigService, StubMailService, SendgridMailService],
      useFactory: (
        config: ConfigService,
        stub: StubMailService,
        sendgrid: SendgridMailService,
      ) => (config.get<string>('mail.driver') === 'sendgrid' ? sendgrid : stub),
    },
  ],
  exports: [MAIL_SERVICE],
})
export class MailModule {}
