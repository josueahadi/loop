import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AfricasTalkingSmsService } from './africas-talking-sms.service';
import { SMS_SERVICE } from './sms.service';
import { StubSmsService } from './stub-sms.service';

// Global so any module can inject SMS_SERVICE. Driver chosen by SMS_DRIVER env,
// mirroring MailModule/PushModule. Defaults to the stub (logs, no credentials).
@Global()
@Module({
  providers: [
    StubSmsService,
    AfricasTalkingSmsService,
    {
      provide: SMS_SERVICE,
      inject: [ConfigService, StubSmsService, AfricasTalkingSmsService],
      useFactory: (
        config: ConfigService,
        stub: StubSmsService,
        africasTalking: AfricasTalkingSmsService,
      ) =>
        config.get<string>('sms.driver') === 'africastalking'
          ? africasTalking
          : stub,
    },
  ],
  exports: [SMS_SERVICE],
})
export class SmsModule {}
