import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthResult, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  ConfirmEmailVerifyDto,
  ConfirmPasswordResetDto,
  RefreshDto,
  RequestPasswordResetDto,
} from './dto/token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.auth.register(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto): Promise<AuthResult> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Public()
  @HttpCode(200)
  @Post('password-reset/request')
  async requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<{ ok: true }> {
    await this.auth.requestPasswordReset(dto.email);
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('password-reset/confirm')
  async confirmPasswordReset(
    @Body() dto: ConfirmPasswordResetDto,
  ): Promise<{ ok: true }> {
    await this.auth.confirmPasswordReset(dto.token, dto.newPassword);
    return { ok: true };
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('email/verify/request')
  async requestEmailVerification(
    @CurrentUser('id') id: string,
  ): Promise<{ ok: true }> {
    await this.auth.requestEmailVerification(id);
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('email/verify/confirm')
  async confirmEmailVerification(
    @Body() dto: ConfirmEmailVerifyDto,
  ): Promise<{ ok: true }> {
    await this.auth.confirmEmailVerification(dto.token);
    return { ok: true };
  }
}
