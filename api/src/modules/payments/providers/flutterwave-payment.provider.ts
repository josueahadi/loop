import { Logger } from '@nestjs/common';
import { PaymentStatus } from '../../../common/enums';
import {
  CheckoutRequest,
  CheckoutResult,
  PaymentProvider,
  WebhookOutcome,
} from './payment-provider';

export interface FlutterwaveConfig {
  secretKey: string;
  webhookHash: string;
}

// Flutterwave (test mode). Uses the hosted "Standard" checkout: we create a
// payment and hand the client Flutterwave's checkout link; Flutterwave then
// calls our webhook. Chosen over Stripe because Stripe has no Rwanda-merchant
// support, whereas Flutterwave settles RWF card + MTN Mobile Money natively.
// Loop is pass-through — this only initiates and reads back status.
export class FlutterwavePaymentProvider implements PaymentProvider {
  readonly name = 'flutterwave';
  private readonly logger = new Logger('FlutterwavePayment');
  private static readonly baseUrl = 'https://api.flutterwave.com/v3';

  constructor(private readonly config: FlutterwaveConfig) {}

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    // tx_ref is OUR payment id, so the webhook maps straight back to our row.
    const res = await fetch(`${FlutterwavePaymentProvider.baseUrl}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: req.paymentId,
        amount: req.amount, // RWF is zero-decimal; send the whole-franc integer
        currency: req.currency,
        redirect_url: req.redirectUrl,
        customer: { email: req.customerEmail, name: req.customerName },
        customizations: { title: 'Loop — pay driver' },
      }),
    });
    if (!res.ok) {
      throw new Error(`Flutterwave responded ${res.status}`);
    }
    const data = (await res.json()) as {
      status?: string;
      data?: { link?: string };
    };
    const link = data?.data?.link;
    if (data?.status !== 'success' || !link) {
      throw new Error('Flutterwave did not return a checkout link');
    }
    // Flutterwave assigns its own transaction id at completion; until then the
    // tx_ref is our stable reference, so we key idempotency on it.
    return { checkoutUrl: link, providerRef: req.paymentId };
  }

  verifyAndParseWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: unknown,
  ): Promise<WebhookOutcome | null> {
    // Flutterwave sends the configured secret hash in the "verif-hash" header.
    // Reject anything that doesn't match — never trust an unverified call.
    const sent = headers['verif-hash'];
    const provided = Array.isArray(sent) ? sent[0] : sent;
    if (!provided || provided !== this.config.webhookHash) {
      this.logger.warn('Rejected webhook: verif-hash mismatch');
      return Promise.resolve(null);
    }

    const body = (
      typeof rawBody === 'string' ? JSON.parse(rawBody || '{}') : (rawBody ?? {})
    ) as {
      data?: {
        tx_ref?: string;
        flw_ref?: string;
        status?: string;
        processor_response?: string;
      };
    };
    const d = body.data;
    if (!d?.tx_ref) return Promise.resolve(null);

    // Flutterwave status → our terminal states.
    const status =
      d.status === 'successful'
        ? PaymentStatus.SUCCESSFUL
        : d.status === 'cancelled'
          ? PaymentStatus.CANCELLED
          : PaymentStatus.FAILED;

    return Promise.resolve({
      paymentId: d.tx_ref,
      providerRef: d.tx_ref,
      status,
      failureReason:
        status === PaymentStatus.SUCCESSFUL ? undefined : d.processor_response,
    });
  }
}
