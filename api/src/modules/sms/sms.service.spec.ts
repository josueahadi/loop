import { AfricasTalkingSmsService } from './africas-talking-sms.service';
import { StubSmsService } from './stub-sms.service';

describe('SMS providers', () => {
  it('stub send resolves without throwing (logs only)', async () => {
    const stub = new StubSmsService();
    await expect(
      stub.send('+250780000000', 'hello'),
    ).resolves.toBeUndefined();
  });

  it('Africa\'s Talking send is a no-op (no throw) when credentials are absent', async () => {
    const config = { get: jest.fn(() => '') } as any;
    const at = new AfricasTalkingSmsService(config);
    // No credentials → returns early, never calls fetch, never throws.
    await expect(
      at.send('+250780000000', 'hello'),
    ).resolves.toBeUndefined();
  });

  it('Africa\'s Talking never throws into the caller on a network error', async () => {
    const config = {
      get: jest.fn((k: string) =>
        k === 'sms.username' ? 'user' : k === 'sms.apiKey' ? 'key' : '',
      ),
    } as any;
    const at = new AfricasTalkingSmsService(config);
    const orig = global.fetch;
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('network down')),
    ) as any;
    await expect(
      at.send('+250780000000', 'hello'),
    ).resolves.toBeUndefined();
    global.fetch = orig;
  });
});
