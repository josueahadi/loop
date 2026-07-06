import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UserRole } from '../../common/enums';
import { AuthService } from './auth.service';

// Unit tests for auth login/register behaviour. External collaborators (users,
// tokens, jwt, config, audit, mail) are mocked. argon2 (native) runs for real so
// the password-verify path is genuinely exercised.
describe('AuthService', () => {
  function makeService(overrides: {
    user?: any;
  } = {}) {
    const users = {
      findByEmail: jest.fn(() => Promise.resolve(overrides.user ?? null)),
      createUser: jest.fn((u: any) =>
        Promise.resolve({ id: 'new-user', ...u }),
      ),
      getByIdOrFail: jest.fn(),
    };
    const tokens = {
      issueRefreshToken: jest.fn(() => Promise.resolve('refresh-token')),
      issueActionToken: jest.fn(() => Promise.resolve('action-token')),
    };
    const jwt = { sign: jest.fn(() => 'access-token') };
    const config = { get: jest.fn(() => 'x') };
    const audit = { record: jest.fn(() => Promise.resolve()) };
    const mail = {
      sendPasswordReset: jest.fn(),
      sendEmailVerification: jest.fn(),
      sendVerificationRejected: jest.fn(),
    };
    const service = new AuthService(
      users as any,
      tokens as any,
      jwt as any,
      config as any,
      audit as any,
      mail as any,
    );
    return { service, users, audit, mail };
  }

  describe('login', () => {
    it('rejects an unknown email', async () => {
      const { service } = makeService({ user: null });
      await expect(
        service.login('nobody@loop.rw', 'pw'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const { service } = makeService({
        user: { id: 'u1', email: 'a@loop.rw', passwordHash, role: UserRole.DRIVER },
      });
      await expect(
        service.login('a@loop.rw', 'wrong-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues tokens on a correct password', async () => {
      const passwordHash = await argon2.hash('correct-password');
      const { service } = makeService({
        user: {
          id: 'u1',
          email: 'a@loop.rw',
          name: 'A',
          passwordHash,
          role: UserRole.DRIVER,
        },
      });
      const result = await service.login('a@loop.rw', 'correct-password');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('audits admin logins with the request context, not regular users', async () => {
      const passwordHash = await argon2.hash('pw');
      // admin → audited
      const admin = makeService({
        user: { id: 'admin', email: 'admin@loop.rw', name: 'Admin', passwordHash, role: UserRole.ADMIN },
      });
      await admin.service.login('admin@loop.rw', 'pw', { ip: '1.2.3.4', userAgent: 'jest' });
      expect(admin.audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.login', ip: '1.2.3.4' }),
      );

      // driver → NOT audited
      const driver = makeService({
        user: { id: 'd', email: 'd@loop.rw', name: 'D', passwordHash, role: UserRole.DRIVER },
      });
      await driver.service.login('d@loop.rw', 'pw');
      expect(driver.audit.record).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('creates a cargo_owner when role is not driver (never admin self-signup)', async () => {
      const { service, users } = makeService();
      await service.register({
        name: 'Owner',
        email: 'owner@loop.rw',
        phone: '+250780000000',
        password: 'pw12345',
        role: 'admin' as any, // attempt to self-register as admin
      });
      expect(users.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.CARGO_OWNER }),
      );
    });

    it('hashes the password (never stores plaintext)', async () => {
      const { service, users } = makeService();
      await service.register({
        name: 'Driver',
        email: 'driver@loop.rw',
        phone: '+250780000001',
        password: 'plaintext-secret',
        role: UserRole.DRIVER,
      });
      const passed = users.createUser.mock.calls[0][0];
      expect(passed.passwordHash).toBeDefined();
      expect(passed.passwordHash).not.toContain('plaintext-secret');
      expect(passed.passwordHash.startsWith('$argon2')).toBe(true);
    });
  });
});
