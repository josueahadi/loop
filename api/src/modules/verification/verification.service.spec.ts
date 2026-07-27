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

// Auto-activate on verification approval: the driver is set online exactly when
// the approval completes all three required documents — not on earlier docs.
describe('VerificationService.review auto-activate', () => {
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
    return { service, users };
  }

  it('activates the driver online when the approval completes all 3 documents', async () => {
    const { service, users } = makeService(3);
    await service.review('rec-1', VerificationStatus.APPROVED, 'admin-1');
    expect(users.activateOnVerification).toHaveBeenCalledWith(DRIVER);
  });

  it('does NOT activate when fewer than 3 documents are approved', async () => {
    const { service, users } = makeService(2);
    await service.review('rec-1', VerificationStatus.APPROVED, 'admin-1');
    expect(users.activateOnVerification).not.toHaveBeenCalled();
  });

  it('does NOT activate on a rejection', async () => {
    const { service, users } = makeService(3);
    await service.review('rec-1', VerificationStatus.REJECTED, 'admin-1', 'blurry');
    expect(users.activateOnVerification).not.toHaveBeenCalled();
  });
});
