import { Logger } from '@nestjs/common';
import { PaymentStatus } from '../../../common/enums';
import {
  CheckoutRequest,
  CheckoutResult,
  PaymentProvider,
  WebhookOutcome,
} from './payment-provider';

// Dev/demo provider: no real money, no credentials. createCheckout returns a
// link to a dev endpoint that auto-succeeds, so the whole owner → pay → webhook →
// paid flow is demonstrable end-to-end. The "webhook" it parses is our own dev
// callback, so verification is a no-op here (the real signature check lives in
// the Flutterwave provider).
export class StubPaymentProvider implements PaymentProvider {
  readonly name = 'stub';
  private readonly logger = new Logger('StubPayment');

  constructor(private readonly apiBaseUrl: string) {}

  createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const providerRef = `stub_${req.paymentId}`;
    // A dev checkout page that, when opened, fires the stub webhook and then
    // redirects back to the app. Handled by PaymentsController.stubCheckout.
    const checkoutUrl = `${this.apiBaseUrl}/payments/stub/checkout/${req.paymentId}`;
    this.logger.log(
      `[stub checkout] payment=${req.paymentId} amount=${req.amount} ${req.currency} -> ${checkoutUrl}`,
    );
    return Promise.resolve({ checkoutUrl, providerRef });
  }

  // The stub's "webhook" is our own trusted dev callback, so there is nothing to
  // verify. It always reports success (the dev happy path); failure paths are
  // exercised by unit tests against the service directly.
  verifyAndParseWebhook(
    _headers: Record<string, string | string[] | undefined>,
    rawBody: unknown,
  ): Promise<WebhookOutcome | null> {
    const body = (rawBody ?? {}) as {
      paymentId?: string;
      status?: string;
    };
    if (!body.paymentId) return Promise.resolve(null);
    return Promise.resolve({
      paymentId: body.paymentId,
      providerRef: `stub_${body.paymentId}`,
      status:
        body.status === 'failed'
          ? PaymentStatus.FAILED
          : PaymentStatus.SUCCESSFUL,
    });
  }
}
