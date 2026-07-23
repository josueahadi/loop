import { createHmac, timingSafeEqual } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { PaymentStatus } from '../../../common/enums';
import {
  CheckoutRequest,
  CheckoutResult,
  PaymentProvider,
  WebhookOutcome,
} from './payment-provider';

export interface FlutterwaveV4Config {
  clientId: string;
  clientSecret: string;
  // HMAC-SHA256 key for webhook signature verification (the dashboard "secret hash").
  webhookHash: string;
  // HTTPS URL Flutterwave returns the browser to after a redirect-based method.
  // v4 rejects custom schemes (loop://…), so this must be http(s).
  redirectUrl: string;
  // Test MoMo msisdn — the payer's phone for the sandbox push. Real integrations
  // collect this from the owner; for the demo it's a fixed sandbox number.
  momoPhone: string;
}

const IDP_TOKEN_URL =
  'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';
const SANDBOX_BASE = 'https://developersandbox-api.flutterwave.com';

class FlutterwaveApiError extends Error {
  constructor(
    message: string,
    readonly type: string | undefined,
    readonly httpStatus: number,
  ) {
    super(message);
  }
}

// Flutterwave v4 (developer sandbox), verified against the live sandbox. v4 is
// OAuth (client-credentials → 10-min bearer) with a multi-step charge:
// create customer → create payment method → charge. For MTN Mobile Money (Rwanda-
// native) the charge is a PUSH: the customer authorises on their phone (USSD) and
// confirmation arrives via the charge.completed webhook — there is no redirect page.
// Loop stays pass-through: this initiates and reads back status; it never holds funds.
export class FlutterwaveV4PaymentProvider implements PaymentProvider {
  readonly name = 'flutterwave_v4';
  private readonly logger = new Logger('FlutterwaveV4Payment');
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: FlutterwaveV4Config) {}

  private async accessToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.token.expiresAt - 30_000 > now) {
      return this.token.value;
    }
    const res = await fetch(IDP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'client_credentials',
      }),
    });
    if (!res.ok) {
      throw new Error(`Flutterwave v4 token request failed (${res.status})`);
    }
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) {
      throw new Error('Flutterwave v4 token response missing access_token');
    }
    this.token = {
      value: data.access_token,
      expiresAt: now + (data.expires_in ?? 600) * 1000,
    };
    return this.token.value;
  }

  private async post(
    path: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<Record<string, unknown>> {
    const token = await this.accessToken();
    const res = await fetch(`${SANDBOX_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (json.status !== 'success') {
      const err = json.error as { type?: string } | undefined;
      throw new FlutterwaveApiError(
        `Flutterwave v4 ${path} failed`,
        err?.type,
        res.status,
      );
    }
    return (json.data ?? {}) as Record<string, unknown>;
  }

  private async get(path: string): Promise<Record<string, unknown>> {
    const token = await this.accessToken();
    const res = await fetch(`${SANDBOX_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return (json.data ?? {}) as Record<string, unknown>;
  }

  // Create the customer, or reuse the existing one if the email already exists
  // (Flutterwave dedupes on email and returns a 409 without the id).
  private async ensureCustomer(
    email: string,
    first: string,
    last: string,
    idempotencyKey: string,
  ): Promise<string> {
    try {
      const created = await this.post(
        '/customers',
        { email, name: { first, last } },
        idempotencyKey,
      );
      return created.id as string;
    } catch (e) {
      if (e instanceof FlutterwaveApiError && e.type === 'RESOURCE_CONFLICT') {
        const existing = await this.get(
          `/customers?email=${encodeURIComponent(email)}`,
        );
        const id = Array.isArray(existing)
          ? (existing[0] as { id?: string })?.id
          : (existing as { id?: string })?.id;
        if (id) return id;
      }
      throw e;
    }
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    // v4 requires an alphanumeric reference; our payment id is a UUID (has hyphens).
    const reference = req.paymentId.replace(/[^a-zA-Z0-9]/g, '');

    // 1. Customer. v4 requires a non-empty last name, so split the display name
    //    ("Demo Owner" → first "Demo", last "Owner") with sensible fallbacks.
    const parts = req.customerName.trim().split(/\s+/);
    const first = parts[0] || 'Loop';
    const last = parts.length > 1 ? parts.slice(1).join(' ') : 'Owner';
    const customerId = await this.ensureCustomer(
      req.customerEmail,
      first,
      last,
      `cust-${reference}`,
    );

    // 2. MTN Mobile Money payment method.
    const pm = await this.post(
      '/payment-methods',
      {
        type: 'mobile_money',
        mobile_money: {
          network: 'MTN',
          country_code: '250',
          phone_number: this.config.momoPhone,
        },
      },
      `pm-${reference}`,
    );
    const paymentMethodId = pm.id as string;

    // 3. Charge. MoMo is a push: this returns status 'pending' and a
    //    payment_instruction (authorise on your phone) — NOT a redirect URL.
    //    The charge.completed webhook is the source of truth for final status.
    const charge = await this.post(
      '/charges',
      {
        customer_id: customerId,
        payment_method_id: paymentMethodId,
        amount: req.amount, // RWF is zero-decimal — whole francs
        currency: req.currency,
        reference,
        redirect_url: this.config.redirectUrl,
      },
      `ch-${reference}`,
    );

    const chargeId = charge.id as string;
    const nextAction = charge.next_action as
      | { type?: string; redirect_url?: { url?: string } }
      | undefined;

    // A redirect-based method (card 3DS) would return a URL; MoMo returns a
    // phone-authorisation instruction. When there's no URL, hand back the API's
    // own callback so the client shows "authorise on your phone, awaiting
    // confirmation" and then waits for the webhook.
    const checkoutUrl =
      nextAction?.redirect_url?.url ?? this.config.redirectUrl;
    return { checkoutUrl, providerRef: chargeId };
  }

  verifyAndParseWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: unknown,
  ): Promise<WebhookOutcome | null> {
    // v4 signs with HMAC-SHA256(secretHash, rawBody) → base64, in the
    // flutterwave-signature header. Verify against the EXACT raw bytes.
    const header = headers['flutterwave-signature'];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature) {
      this.logger.warn('Rejected webhook: missing flutterwave-signature');
      return Promise.resolve(null);
    }
    const raw =
      typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody ?? {});
    const expected = createHmac('sha256', this.config.webhookHash)
      .update(raw)
      .digest('base64');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      this.logger.warn('Rejected webhook: flutterwave-signature mismatch');
      return Promise.resolve(null);
    }

    const body = (
      typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody
    ) as {
      event?: string;
      data?: { reference?: string; id?: string; status?: string };
    };
    const d = body.data ?? {};
    if (!d.reference) return Promise.resolve(null);

    // v4 success is charge.completed with data.status === 'succeeded'.
    const status =
      d.status === 'succeeded'
        ? PaymentStatus.SUCCESSFUL
        : d.status === 'failed'
          ? PaymentStatus.FAILED
          : PaymentStatus.CANCELLED;

    return Promise.resolve({
      paymentId: d.reference,
      providerRef: d.id ?? d.reference,
      status,
      failureReason: status === PaymentStatus.SUCCESSFUL ? undefined : d.status,
    });
  }
}
