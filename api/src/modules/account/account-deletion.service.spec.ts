import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';

// Unit tests for account erasure. The DataSource and Storage are mocked; the
// HMAC hashing runs for real so determinism is genuinely exercised.
describe('AccountDeletionService', () => {
  function make(rows: Record<string, unknown[]> = {}) {
    const queries: string[] = [];
    const query = jest.fn((sql: string) => {
      queries.push(sql);
      for (const [needle, result] of Object.entries(rows)) {
        if (sql.includes(needle)) return Promise.resolve(result);
      }
      return Promise.resolve([]);
    });
    const manager = { query: jest.fn(() => Promise.resolve([])) };
    const ds = {
      query,
      transaction: jest.fn((cb: any) => cb(manager)),
    };
    const storage = { deleteByPrefix: jest.fn(() => Promise.resolve(3)) };
    const config = { get: jest.fn(() => 'test-secret') };
    const service = new AccountDeletionService(
      ds as any,
      storage as any,
      config as any,
    );
    return { service, ds, manager, storage, queries };
  }

  it('hashes identifiers deterministically and case-insensitively, without echoing the raw value', () => {
    const { service } = make();
    const a = service.hashIdentifier('User@Example.com');
    const b = service.hashIdentifier('user@example.com  ');
    expect(a).toBe(b);
    expect(a).not.toContain('example.com');
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('throws NotFound when the user does not exist', async () => {
    const { service } = make({ 'FROM users WHERE id': [] });
    await expect(service.deleteUser('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses to delete the last admin', async () => {
    const { service } = make({
      'FROM users WHERE id': [
        { id: 'a1', email: 'a@loop.rw', phone: '+250780000000', role: 'admin' },
      ],
      "role = 'admin'": [{ count: 1 }],
    });
    await expect(service.deleteUser('a1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('purges documents, scrubs payment payloads, and deletes the user', async () => {
    const { service, manager, storage } = make({
      'FROM users WHERE id': [
        {
          id: 'u1',
          email: 'd@loop.rw',
          phone: '+250780000001',
          role: 'driver',
        },
      ],
    });
    const result = await service.deleteUser('u1');

    expect(storage.deleteByPrefix).toHaveBeenCalledWith('verification/u1/');
    const sql = manager.query.mock.calls.map((c) => c[0] as string);
    expect(sql.some((s) => s.includes('raw_webhook_payload = NULL'))).toBe(true);
    expect(sql.some((s) => s.includes('DELETE FROM users'))).toBe(true);
    expect(sql.some((s) => s.includes('account_blocklist'))).toBe(false);
    expect(result).toEqual({ filesPurged: 3, blocklisted: false });
  });

  it('records a blocklist entry when a reason is given', async () => {
    const { service, manager } = make({
      'FROM users WHERE id': [
        {
          id: 'u2',
          email: 'f@loop.rw',
          phone: '+250780000002',
          role: 'driver',
        },
      ],
    });
    const result = await service.deleteUser('u2', {
      blocklistReason: 'false documents',
    });
    const sql = manager.query.mock.calls.map((c) => c[0] as string);
    expect(sql.some((s) => s.includes('INSERT INTO account_blocklist'))).toBe(
      true,
    );
    expect(result.blocklisted).toBe(true);
  });
});
