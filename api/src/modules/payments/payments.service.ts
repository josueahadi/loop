import { createHmac } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { JobStatus, PaymentStatus, ProposalStatus } from '../../common/enums';
import { PushService } from '../push/push.service';
import { Job } from '../jobs/entities/job.entity';
import { Proposal } from '../proposals/entities/proposal.entity';
import { User } from '../users/entities/user.entity';
import {
  CreatePaymentResponseDto,
  PaymentResponseDto,
} from './dto/payment.dto';
import { Payment } from './entities/payment.entity';
import { FlutterwavePaymentProvider } from './providers/flutterwave-payment.provider';
import { FlutterwaveV4PaymentProvider } from './providers/flutterwave-v4-payment.provider';
import { PaymentProvider, WebhookOutcome } from './providers/payment-provider';
import { StubPaymentProvider } from './providers/stub-payment.provider';

// Pass-through payments. Loop initiates a checkout and records the provider's
// webhook-confirmed outcome — it never holds funds. The amount is locked to the
// job's posted price; the webhook is the only thing that moves a payment to a
// terminal state, and it is idempotent on provider_ref.
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');
  private readonly provider: PaymentProvider;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Payment)
    private readonly payments: Repository<Payment>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Proposal)
    private readonly proposals: Repository<Proposal>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly push: PushService,
  ) {
    this.provider = this.buildProvider();
  }

  private buildProvider(): PaymentProvider {
    const driver = this.config.get<string>('payments.driver') ?? 'stub';
    if (driver === 'flutterwave_v4') {
      return new FlutterwaveV4PaymentProvider({
        clientId: this.config.get<string>('payments.flutterwaveClientId')!,
        clientSecret: this.config.get<string>(
          'payments.flutterwaveClientSecret',
        )!,
        webhookHash: this.config.get<string>(
          'payments.flutterwaveWebhookHash',
        )!,
        // v4 rejects custom schemes; use an HTTPS callback (deep-links onward).
        redirectUrl:
          this.config.get<string>('payments.v4RedirectUrl') ??
          `${this.config.get<string>('appUrl') ?? ''}/payments/callback`,
        momoPhone:
          this.config.get<string>('payments.v4MomoPhone') ?? '0780000000',
        appUrl: this.config.get<string>('appUrl') ?? 'http://localhost:3000',
      });
    }
    if (driver === 'flutterwave') {
      return new FlutterwavePaymentProvider({
        secretKey: this.config.get<string>('payments.flutterwaveSecretKey')!,
        webhookHash: this.config.get<string>(
          'payments.flutterwaveWebhookHash',
        )!,
      });
    }
    this.logger.warn(
      'PAYMENT_DRIVER=stub — checkouts auto-succeed, no real money moves',
    );
    return new StubPaymentProvider(
      this.config.get<string>('appUrl') ?? 'http://localhost:3000',
    );
  }

  get driverName(): string {
    return this.provider.name;
  }

  // Owner initiates payment on a completed job. Amount is locked to the posted
  // price; a second attempt after a successful payment is a 409.
  async initiate(
    jobId: string,
    userId: string,
  ): Promise<CreatePaymentResponseDto> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.ownerId !== userId) {
      throw new ForbiddenException('Only the job owner can pay');
    }
    if (job.status !== JobStatus.COMPLETED) {
      throw new ConflictException('Payment is only allowed on a completed job');
    }
    if (job.price == null) {
      throw new ConflictException('Job has no posted price');
    }

    const accepted = await this.proposals.findOne({
      where: { jobId, status: ProposalStatus.ACCEPTED },
    });
    if (!accepted) throw new ConflictException('Job has no accepted driver');

    // No second settlement.
    const existingSuccess = await this.payments.findOne({
      where: { jobId, status: PaymentStatus.SUCCESSFUL },
    });
    if (existingSuccess) {
      throw new ConflictException('This job has already been paid');
    }

    // Reuse an existing pending row rather than piling up duplicates.
    let payment = await this.payments.findOne({
      where: { jobId, status: PaymentStatus.PENDING },
    });
    if (!payment) {
      payment = this.payments.create({
        jobId,
        payerId: job.ownerId,
        payeeId: accepted.driverId,
        amount: job.price, // LOCKED to the posted price — client never sends it
        currency: 'RWF',
        provider: this.provider.name,
        // Temporary until the provider assigns one; unique so we set it below.
        providerRef: `init_${jobId}_${Date.now()}`,
        status: PaymentStatus.PENDING,
      });
      payment = await this.payments.save(payment);
    }

    const owner = await this.users.findOne({ where: { id: job.ownerId } });
    const checkout = await this.provider.createCheckout({
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      customerEmail: owner?.email ?? 'owner@loop.rw',
      customerName: owner?.name ?? 'Loop owner',
      redirectUrl: this.config.get<string>('payments.redirectUrl')!,
    });

    payment.providerRef = checkout.providerRef;
    await this.payments.save(payment);

    return {
      payment_id: payment.id,
      checkout_url: checkout.checkoutUrl,
      status: payment.status,
    };
  }

  // Provider webhook. Verified + idempotent: a replay with the same provider_ref
  // reaches the same terminal state and never double-writes. Returns true when
  // the call was accepted (verified), false when it must be rejected (401).
  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: unknown,
  ): Promise<boolean> {
    const outcome = await this.provider.verifyAndParseWebhook(headers, rawBody);
    if (!outcome) return false; // unverified / unparseable → reject

    // Resolve by our payment id, falling back to the provider's own reference.
    // Some providers (Flutterwave v4) require an alphanumeric reference, so the
    // UUID is sanitised on the way out and won't equal our id on the way back —
    // provider_ref (the charge id) is the stable handle in that case.
    const payment =
      (await this.payments.findOne({ where: { id: outcome.paymentId } })) ??
      (await this.payments.findOne({
        where: { providerRef: outcome.providerRef },
      }));
    if (!payment) {
      // Verified but unknown id — accept (don't make the provider retry forever).
      this.logger.warn(`Webhook for unknown payment ${outcome.paymentId}`);
      return true;
    }

    // Idempotency: if already terminal, do nothing (store nothing new).
    if (payment.status !== PaymentStatus.PENDING) {
      return true;
    }

    await this.applyOutcome(payment, outcome, rawBody);
    return true;
  }

  private async applyOutcome(
    payment: Payment,
    outcome: WebhookOutcome,
    rawBody: unknown,
  ): Promise<void> {
    payment.status = outcome.status;
    payment.rawWebhookPayload = rawBody;
    payment.failureReason = outcome.failureReason ?? null;
    if (outcome.status === PaymentStatus.SUCCESSFUL) {
      payment.paidAt = new Date();
    }

    try {
      await this.payments.save(payment);
    } catch (err) {
      // The partial unique index rejects a second successful payment on the same
      // job — treat that as an idempotent no-op rather than an error.
      if (err instanceof QueryFailedError) {
        this.logger.warn(
          `Concurrent settlement rejected for job ${payment.jobId}`,
        );
        return;
      }
      throw err;
    }

    // Best-effort push; never blocks or fails the webhook.
    if (outcome.status === PaymentStatus.SUCCESSFUL) {
      void this.push.sendToUser(payment.payeeId, {
        title: 'Payment received',
        body: `You have been paid ${payment.amount} RWF.`,
        data: { type: 'payment_success', jobId: payment.jobId },
      });
    } else {
      void this.push.sendToUser(payment.payerId, {
        title: 'Payment failed',
        body: 'Your payment did not go through. You can try again.',
        data: { type: 'payment_failed', jobId: payment.jobId },
      });
    }
  }

  // Participant-only read of the job's payment.
  async getForJob(
    jobId: string,
    userId: string,
  ): Promise<PaymentResponseDto | null> {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    const accepted = await this.proposals.findOne({
      where: { jobId, status: ProposalStatus.ACCEPTED },
    });
    const participants = [job.ownerId, accepted?.driverId].filter(Boolean);
    if (!participants.includes(userId)) {
      throw new ForbiddenException(
        'Only the job participants can view payment',
      );
    }

    // The most recent payment row for this job (successful wins if present).
    const payment = await this.payments.findOne({
      where: { jobId },
      order: { createdAt: 'DESC' },
    });
    return payment ? PaymentResponseDto.from(payment) : null;
  }

  // Dev-only: drive the stub webhook from the fake checkout page.
  async stubSettle(paymentId: string): Promise<void> {
    await this.handleWebhook({}, { paymentId, status: 'successful' });
  }

  // Dev/demo only: simulate the MTN Mobile Money approval that a real subscriber
  // would give on their phone. Builds the exact charge.completed payload, signs
  // it with the configured secret hash, and runs it through the REAL webhook path
  // (HMAC verify + idempotency) — so it proves the verification works rather than
  // bypassing it. Only meaningful under PAYMENT_DRIVER=flutterwave_v4.
  async simulateV4Approval(paymentId: string): Promise<void> {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    const body = JSON.stringify({
      event: 'charge.completed',
      data: {
        reference: paymentId.replace(/[^a-zA-Z0-9]/g, ''),
        id: payment.providerRef,
        status: 'succeeded',
      },
    });
    const hash = this.config.get<string>('payments.flutterwaveWebhookHash') ?? '';
    const signature = createHmac('sha256', hash).update(body).digest('base64');
    const accepted = await this.handleWebhook(
      { 'flutterwave-signature': signature },
      body,
    );
    if (!accepted) {
      throw new Error('Simulated webhook was rejected (check FLUTTERWAVE_WEBHOOK_HASH)');
    }
  }
}
