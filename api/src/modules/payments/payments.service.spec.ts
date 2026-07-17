import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus, PaymentStatus, ProposalStatus } from '../../common/enums';
import { PaymentsService } from './payments.service';

// Unit tests for the pass-through payment guards and webhook idempotency.
// Repositories, config, and push are mocked; PAYMENT_DRIVER defaults to stub so
// createCheckout needs no network.
describe('PaymentsService', () => {
  const OWNER = 'owner-1';
  const DRIVER = 'driver-1';
  const OUTSIDER = 'outsider-1';
  const JOB = 'job-1';

  function make(opts: {
    job?: any;
    accepted?: any;
    successfulExisting?: any;
    pendingExisting?: any;
    paymentById?: any;
  }) {
    const saved: any[] = [];
    const paymentsRepo = {
      findOne: jest.fn(({ where }: any) => {
        if (where.id) return Promise.resolve(opts.paymentById ?? null);
        if (where.status === PaymentStatus.SUCCESSFUL) {
          return Promise.resolve(opts.successfulExisting ?? null);
        }
        if (where.status === PaymentStatus.PENDING) {
          return Promise.resolve(opts.pendingExisting ?? null);
        }
        // getForJob: latest row
        return Promise.resolve(opts.paymentById ?? null);
      }),
      create: jest.fn((p: any) => ({ id: 'pay-1', ...p })),
      save: jest.fn((p: any) => {
        saved.push({ ...p });
        return Promise.resolve(p);
      }),
    };
    const jobsRepo = {
      findOne: jest.fn(() => Promise.resolve(opts.job ?? null)),
    };
    const proposalsRepo = {
      findOne: jest.fn(() =>
        Promise.resolve(
          opts.accepted ?? {
            driverId: DRIVER,
            status: ProposalStatus.ACCEPTED,
          },
        ),
      ),
    };
    const usersRepo = {
      findOne: jest.fn(() =>
        Promise.resolve({ id: OWNER, email: 'o@loop.rw', name: 'Owner' }),
      ),
    };
    const push = { sendToUser: jest.fn(() => Promise.resolve()) };
    const config = {
      get: jest.fn((k: string) => {
        if (k === 'payments.driver') return 'stub';
        if (k === 'appUrl') return 'http://localhost:3000';
        if (k === 'payments.redirectUrl') return 'loop://cb';
        return '';
      }),
    };
    const service = new PaymentsService(
      config as any,
      paymentsRepo as any,
      jobsRepo as any,
      proposalsRepo as any,
      usersRepo as any,
      push as any,
    );
    return { service, paymentsRepo, push, saved };
  }

  const completedJob = () => ({
    id: JOB,
    ownerId: OWNER,
    status: JobStatus.COMPLETED,
    price: 8000,
  });

  describe('initiate guards', () => {
    it('rejects a non-owner with 403', async () => {
      const { service } = make({ job: completedJob() });
      await expect(service.initiate(JOB, OUTSIDER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects a non-completed job with 409', async () => {
      const { service } = make({
        job: { ...completedJob(), status: JobStatus.MATCHED },
      });
      await expect(service.initiate(JOB, OWNER)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects a second payment after a successful one with 409', async () => {
      const { service } = make({
        job: completedJob(),
        successfulExisting: { id: 'pay-0', status: PaymentStatus.SUCCESSFUL },
      });
      await expect(service.initiate(JOB, OWNER)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('404s when the job does not exist', async () => {
      const { service } = make({ job: null });
      await expect(service.initiate(JOB, OWNER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('creates a pending payment locked to the posted price', async () => {
      const { service, saved } = make({ job: completedJob() });
      const res = await service.initiate(JOB, OWNER);
      expect(res.status).toBe(PaymentStatus.PENDING);
      expect(res.checkout_url).toContain('/payments/stub/checkout/');
      // amount came from job.price, never from any client input
      expect(saved[0].amount).toBe(8000);
      expect(saved[0].payerId).toBe(OWNER);
      expect(saved[0].payeeId).toBe(DRIVER);
    });
  });

  describe('getForJob', () => {
    it('rejects a non-participant with 403', async () => {
      const { service } = make({ job: completedJob() });
      await expect(service.getForJob(JOB, OUTSIDER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('webhook idempotency', () => {
    const pending = () => ({
      id: 'pay-1',
      jobId: JOB,
      payerId: OWNER,
      payeeId: DRIVER,
      amount: 8000,
      status: PaymentStatus.PENDING,
    });

    it('flips a pending payment to successful and pushes the driver', async () => {
      const p = pending();
      const { service, push, saved } = make({ paymentById: p });
      await service.handleWebhook(
        {},
        { paymentId: 'pay-1', status: 'successful' },
      );
      expect(saved[0].status).toBe(PaymentStatus.SUCCESSFUL);
      expect(saved[0].paidAt).toBeInstanceOf(Date);
      expect(push.sendToUser).toHaveBeenCalledWith(
        DRIVER,
        expect.objectContaining({ title: 'Payment received' }),
      );
    });

    it('is idempotent: a replay on an already-successful payment writes nothing', async () => {
      const p = { ...pending(), status: PaymentStatus.SUCCESSFUL };
      const { service, saved, push } = make({ paymentById: p });
      const accepted = await service.handleWebhook(
        {},
        { paymentId: 'pay-1', status: 'successful' },
      );
      expect(accepted).toBe(true); // accepted, but…
      expect(saved).toHaveLength(0); // …no second write
      expect(push.sendToUser).not.toHaveBeenCalled();
    });

    it('rejects an unverified/unparseable webhook (no paymentId)', async () => {
      const { service } = make({});
      const accepted = await service.handleWebhook({}, {});
      expect(accepted).toBe(false);
    });
  });
});
