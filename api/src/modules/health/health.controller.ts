import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

// Liveness probe for Railway's healthcheck. Public (no auth) and dependency-free
// so it returns 200 as soon as the process is up — it does NOT check the DB, so a
// transient DB blip doesn't fail the deploy healthcheck and trigger a rollback.
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
