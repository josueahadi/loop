import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CreatePaymentResponseDto,
  PaymentResponseDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // Owner initiates payment on a completed job. Amount is locked server-side to
  // the posted price; the service enforces owner-only / completed / no-double.
  @ApiBearerAuth()
  @Post('jobs/:jobId/payment')
  initiate(
    @CurrentUser('id') userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<CreatePaymentResponseDto> {
    return this.payments.initiate(jobId, userId);
  }

  // Participant-only read of the job's payment. Returns null if none yet.
  @ApiBearerAuth()
  @Get('jobs/:jobId/payment')
  get(
    @CurrentUser('id') userId: string,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<PaymentResponseDto | null> {
    return this.payments.getForJob(jobId, userId);
  }

  // Provider-called webhook. Public (no JWT); verified inside via the provider's
  // signature/secret hash. The single source of truth for payment status.
  @Public()
  @Post('payments/webhook')
  @HttpCode(200)
  async webhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ): Promise<{ received: true }> {
    const accepted = await this.payments.handleWebhook(headers, body);
    if (!accepted) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    return { received: true };
  }

  // Dev-only stub checkout page: settles the payment (stub webhook) and redirects
  // back to the app deep link. Only meaningful under PAYMENT_DRIVER=stub.
  @Public()
  @ApiExcludeEndpoint()
  @Get('payments/stub/checkout/:paymentId')
  async stubCheckout(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.payments.stubSettle(paymentId);
    // A tiny page so the flow is visible in a browser/webview, then bounce back.
    res.type('html').send(
      `<html><body style="font-family:sans-serif;text-align:center;padding:40px">
         <h2>✅ Payment successful (stub)</h2>
         <p>You can return to the Loop app.</p>
         <script>setTimeout(function(){ location.href='loop://payment-callback'; }, 800);</script>
       </body></html>`,
    );
  }
}
