import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { PushService } from './push.service';

// Global so proposals + messaging can inject it without extra wiring.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
