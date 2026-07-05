import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ActionTokenType, UserRole } from '../../common/enums';
import { MAIL_SERVICE, MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { TokensService } from './tokens.service';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDto;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokensService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(MAIL_SERVICE) private readonly mail: MailService,
  ) {}

  private issueAccessToken(user: User): string {
    return this.jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessTtl'),
      },
    );
  }

  private async buildResult(user: User): Promise<AuthResult> {
    return {
      accessToken: this.issueAccessToken(user),
      refreshToken: await this.tokens.issueRefreshToken(user.id),
      user: UserResponseDto.from(user),
    };
  }

  private link(path: string, token: string): string {
    const base = this.config.get<string>('appUrl');
    return `${base}${path}?token=${token}`;
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    // Admin accounts are seeded, never self-registered.
    const role =
      dto.role === UserRole.DRIVER ? UserRole.DRIVER : UserRole.CARGO_OWNER;
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.users.createUser({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role,
    });
    // Fire an email-verify link, but do NOT block login on it (MVP decision #7).
    await this.sendEmailVerification(user);
    return this.buildResult(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(email);
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Note: email verification is intentionally not enforced here.
    return this.buildResult(user);
  }

  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const rotated = await this.tokens.rotateRefreshToken(rawRefreshToken);
    if (!rotated) throw new UnauthorizedException('Invalid refresh token');
    const user = await this.users.getByIdOrFail(rotated.userId);
    return {
      accessToken: this.issueAccessToken(user),
      refreshToken: rotated.refreshToken,
      user: UserResponseDto.from(user),
    };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.tokens.revokeRefreshToken(rawRefreshToken);
  }

  // ---- password reset ----
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    // Always return 200 regardless, to avoid leaking which emails exist.
    if (!user) return;
    const token = await this.tokens.issueActionToken(
      user.id,
      ActionTokenType.PASSWORD_RESET,
    );
    await this.mail.sendPasswordReset(
      user.email,
      user.name,
      this.link('/reset-password', token),
    );
  }

  async confirmPasswordReset(
    token: string,
    newPassword: string,
  ): Promise<void> {
    const userId = await this.tokens.consumeActionToken(
      token,
      ActionTokenType.PASSWORD_RESET,
    );
    if (!userId) throw new UnauthorizedException('Invalid or expired token');
    const passwordHash = await argon2.hash(newPassword);
    await this.users.setPasswordHash(userId, passwordHash);
    // Invalidate existing sessions after a password change.
    await this.tokens.revokeAllForUser(userId);
  }

  // ---- email verification (non-blocking) ----
  private async sendEmailVerification(user: User): Promise<void> {
    const token = await this.tokens.issueActionToken(
      user.id,
      ActionTokenType.EMAIL_VERIFY,
    );
    await this.mail.sendEmailVerification(
      user.email,
      user.name,
      this.link('/verify-email', token),
    );
  }

  async requestEmailVerification(userId: string): Promise<void> {
    const user = await this.users.getByIdOrFail(userId);
    if (user.emailVerifiedAt) return;
    await this.sendEmailVerification(user);
  }

  async confirmEmailVerification(token: string): Promise<void> {
    const userId = await this.tokens.consumeActionToken(
      token,
      ActionTokenType.EMAIL_VERIFY,
    );
    if (!userId) throw new UnauthorizedException('Invalid or expired token');
    await this.users.markEmailVerified(userId);
  }
}
