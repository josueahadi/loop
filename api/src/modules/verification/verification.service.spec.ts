import { NotFoundException } from '@nestjs/common';
import { VerificationStatus } from '../../common/enums';
import { VerificationService } from './verification.service';

// Unit test for the driver-scoped document-URL guard: a driver may only fetch a
// signed URL for their OWN verification records. Repos + storage are mocked.
describe('VerificationService.ownDocumentUrl', () => {
  const DRIVER = 'driver-1';

  function makeService(record: any) {
    const records = { findOne: jest.fn(() => Promise.resolve(record)) };
    const storage = {
      signedUrl: jest.fn(() =>
        Promise.resolve({ url: 'https://signed/url', stub: false }),
      ),
    };
    const push = { sendToUser: jest.fn() };
    const mail = {};
    const users = { activateOnVerification: jest.fn() };
    const service = new VerificationService(
      records as any,
      storage as any,
      push as any,
      mail as any,
      users as any,
    );
    return { service, storage };
  }

  it('returns a signed URL for the driver’s own record', async () => {
    const { service, storage } = makeService({
      id: 'rec-1',
      driverId: DRIVER,
      storageReference: 'verification/driver-1/licence-123.png',
    });
    const result = await service.ownDocumentUrl(DRIVER, 'rec-1');
    expect(result.url).toBe('https://signed/url');
    expect(storage.signedUrl).toHaveBeenCalledWith(
      'verification/driver-1/licence-123.png',
    );
  });

  it('404s when another driver tries to fetch the record', async () => {
    const { service, storage } = makeService({
      id: 'rec-1',
      driverId: 'someone-else',
      storageReference: 'verification/someone-else/licence.png',
    });
    await expect(
      service.ownDocumentUrl(DRIVER, 'rec-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.signedUrl).not.toHaveBeenCalled();
  });

  it('404s when the record does not exist', async () => {
    const { service } = makeService(null);
    await expect(
      service.ownDocumentUrl(DRIVER, 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// On the approval that completes all three required documents, the driver is
// NOT auto-set online (that would show an ONLINE badge without a location and
// leave them unmatchable). Instead the completion push nudges them to go online
// from the app, where the go-online action captures their GPS.
describe('VerificationService.review completion nudge', () => {
  const DRIVER = 'driver-1';

  // approvedCount = how many DISTINCT required docs are approved AFTER this review
  // (what isFullyVerified's COUNT query returns).
  function makeService(approvedCount: number) {
    const pendingRecord = {
      id: 'rec-1',
      driverId: DRIVER,
      documentType: 'licence',
      status: VerificationStatus.PENDING,
      driver: { email: 'd@x.rw', name: 'Driver' },
    };
    const qb: any = {
      select: () => qb,
      where: () => qb,
      andWhere: () => qb,
      getRawOne: jest.fn(() =>
        Promise.resolve({ count: String(approvedCount) }),
      ),
    };
    const records = {
      findOne: jest.fn(() => Promise.resolve({ ...pendingRecord })),
      save: jest.fn((r: any) => Promise.resolve(r)),
      createQueryBuilder: jest.fn(() => qb),
    };
    const storage = {};
    const push = { sendToUser: jest.fn() };
    const mail = { sendVerificationRejected: jest.fn() };
    // activateOnVerification must NOT be called anymore.
    const users = {
      activateOnVerification: jest.fn(() => Promise.resolve()),
    };
    const service = new VerificationService(
      records as any,
      storage as any,
      push as any,
      mail as any,
      users as any,
    );
    return { service, users, push };
  }

  it('never auto-sets the driver online, even when all 3 docs are approved', async () => {
    const { service, users } = makeService(3);
    await service.review('rec-1', VerificationStatus.APPROVED, 'admin-1');
    expect(users.activateOnVerification).not.toHaveBeenCalled();
  });

  it('nudges the driver to go online when the approval completes verification', async () => {
    const { service, push } = makeService(3);
    await service.review('rec-1', VerificationStatus.APPROVED, 'admin-1');
    const msg = push.sendToUser.mock.calls.at(-1)?.[1];
    expect(msg.title).toBe("You're verified");
    expect(msg.body).toMatch(/go online/i);
  });

  it('does not nudge to go online on a non-final document approval', async () => {
    const { service, push } = makeService(2);
    await service.review('rec-1', VerificationStatus.APPROVED, 'admin-1');
    const msg = push.sendToUser.mock.calls.at(-1)?.[1];
    expect(msg.title).toBe('Document approved');
  });
});
