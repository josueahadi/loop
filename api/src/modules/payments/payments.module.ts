import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from '../jobs/entities/job.entity';
import { Proposal } from '../proposals/entities/proposal.entity';
import { PushModule } from '../push/push.module';
import { User } from '../users/entities/user.entity';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Job, Proposal, User]),
    PushModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
