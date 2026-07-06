import { NotFoundException } from '@nestjs/common';
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
    const service = new VerificationService(
      records as any,
      storage as any,
      push as any,
      mail as any,
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
