import { PaymentStatus } from '../../../common/enums';

// What a provider needs to build a hosted checkout for one payment.
export interface CheckoutRequest {
  // Our payment id; becomes the provider tx_ref so the webhook maps back to it.
  paymentId: string;
  amount: number; // whole RWF
  currency: string; // 'RWF'
  customerEmail: string;
  customerName: string;
  // Where the provider sends the browser after checkout (a Loop deep link).
  redirectUrl: string;
}

export interface CheckoutResult {
  // Hosted checkout URL the client opens.
  checkoutUrl: string;
  // The provider's own reference for this transaction, stored as provider_ref.
  providerRef: string;
}

// The verified, normalised outcome of a webhook call.
export interface WebhookOutcome {
  // Our payment id (from tx_ref).
  paymentId: string;
  providerRef: string;
  status: PaymentStatus; // successful | failed | cancelled (never pending)
  failureReason?: string;
}

// A swappable payment provider (stub | flutterwave), same pattern as the
// mail/storage/push drivers. Loop is pass-through only: providers move money
// owner → driver and report back; Loop never holds it.
export interface PaymentProvider {
  readonly name: string;

  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;

  // Verify the webhook's authenticity (signature/secret hash) and parse it into a
  // normalised outcome. Returns null if the signature is invalid or the payload
  // can't be understood — the caller then rejects the webhook. MUST NOT trust an
  // unverified call.
  verifyAndParseWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: unknown,
  ): Promise<WebhookOutcome | null>;
}
