# Loop — Changes Log (post-BUILD_SPEC)

Changes made after the original `BUILD_SPEC.md` was written — mostly in response to pilot findings and supervisor feedback. This is the authoritative record of what the current system does where it differs from BUILD_SPEC. Money is integer RWF throughout; external services stay behind swappable provider interfaces.

---

## 1. Payments — provider drivers (v3, v4) and in-app card

`PAYMENT_DRIVER` now selects one of **three** drivers (BUILD_SPEC listed only `stub | flutterwave`):

| `PAYMENT_DRIVER` | What it does | Payment method |
|---|---|---|
| `stub` (default) | Dev endpoint auto-succeeds; no credentials, no real money | none |
| `flutterwave` | **Flutterwave v3** hosted checkout — a real payment page opens in the app | **card + MTN Mobile Money** |
| `flutterwave_v4` | Flutterwave v4 (developer sandbox): OAuth + orchestrated charge | **MTN Mobile Money** (phone-push) |

Pass-through is unchanged: Loop never holds funds, the charged amount is locked server-side to the job's posted price, and the **signature-verified webhook is the only thing that moves a payment to a terminal state** (the client never self-reports success — verified on both the app and the API).

### The live demo runs on the v3 card flow

Uses the sandbox **V3 Test API keys** (Settings → API keys → *V3 Test API keys* in the Flutterwave dashboard). Env on the API service:

```
PAYMENT_DRIVER=flutterwave
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-...
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_TEST-...
FLUTTERWAVE_WEBHOOK_HASH=<the secret hash set in the dashboard>
```

Webhook (Flutterwave dashboard → **Webhooks → V3 Test webhooks**):

- URL: `https://loop-api-prod.up.railway.app/payments/webhook`
- Secret hash: must equal `FLUTTERWAVE_WEBHOOK_HASH`
- **Enable v3 webhooks** must be toggled ON.
- The "custom URL" preferences (failed-transactions / refunds) are **not** needed — the single main URL receives all events.

The v3 provider sends the secret hash in the `verif-hash` header; the API rejects any webhook whose header doesn't match. The v4 provider instead verifies an HMAC-SHA256 `flutterwave-signature` over the raw body (that's why the API keeps the raw request body — `rawBody: true` in `main.ts`).

### Demo flow (v3 card)

1. Owner completes a job → taps **"Pay driver · X RWF"**.
2. The Flutterwave hosted page opens in a webview.
3. Owner enters a **test card**, PIN, OTP → pays.
4. Flutterwave fires the webhook → the API flips the payment to **Paid** (verified, idempotent on `provider_ref`).
5. The app polls and the status chip shows **Paid**.

### Flutterwave sandbox test cards

Test cards work only against test keys / the sandbox — never live. Canonical Flutterwave test cards (use the CURRENT expiry — a future year like 09/32):

| Type | Number | CVV | Expiry | PIN | OTP |
|---|---|---|---|---|---|
| Mastercard | 5531 8866 5214 2950 | 564 | 09/(future) | 3310 | 12345 |
| Visa | 4187 4274 1556 4246 | 828 | 09/(future) | 3310 | 12345 |

Always-current list: https://developer.flutterwave.com/docs/testing (and the dashboard's test-cards reference). If a card is declined for "expired", bump the expiry year.

### In-app payment is the primary path (UX)

On a completed job the owner sees a prominent **"Pay driver · X RWF"** button. Off-platform settlement is still valid but is de-emphasised to a small secondary link; choosing it records **no** payment state (only the provider webhook can confirm a payment).

### Why not Stripe / v4-card note

Stripe still can't onboard a Rwanda merchant (unchanged). On v4, card requires client-side AES-GCM encryption whose exact byte-format is undocumented — so the **card demo uses v3** (hosted page, no encryption needed) and **MoMo uses v4**.

---

## 2. Pricing v3 — weight is now a direct term + realistic rates

BUILD_SPEC's formula had no weight term (weight only nudged price via the size bucket). v3 adds a per-kg term and recalibrates all rates to realistic Kigali levels. Still rule-based, no ML, all values in `pricing_config` (DB/seed).

```
estimated_price = max( min_fare,
                       base_fare + rate_per_km·km + rate_per_min·min
                                 + rate_per_kg·weight )
                  × size_factor
```

- The time term is dropped on the great-circle fallback (OSRM down); the weight term is dropped when weight is unknown.
- **`size_factor` is about bulk/awkwardness, NOT weight** — the two are priced separately (bulk via size, weight via `rate_per_kg`). Size has no kg thresholds; the owner picks small/medium/large by how much space it takes.

**v3 config** (`base_fare / rate_per_km / rate_per_min / rate_per_kg / min_fare`, RWF):

| Vehicle | base | /km | /min | /kg | min_fare |
|---|---|---|---|---|---|
| moto | 800 | 280 | 25 | 6 | 1000 |
| pickup | 2500 | 550 | 50 | 8 | 3000 |
| van | 3500 | 700 | 60 | 6 | 4500 |
| small_truck | 5000 | 1000 | 90 | 4 | 7000 |
| large_truck | 8000 | 1600 | 150 | 3 | 12000 |

Size multipliers: small 1.00, medium 1.30, large 1.60.

Migration `1721100000000-PricingV3WeightTerm` adds `rate_per_kg` and updates the rows; `run-seed.ts` seeds v3 for fresh setups. Weight flows end-to-end already (mobile create-job → `POST /pricing/estimate` with `weight_kg` → formula).

*Example:* 150 kg office furniture, pickup, medium, ~4 km/10 min ≈ **8,320 RWF** (was ~5,200 and weight-insensitive under v2).

---

## 3. Auto-activate driver on verification approval

When the approval of a driver's **final** required document completes all three (licence, national ID, vehicle reg), the driver is set **online** once as a "you're live" signal. Their manual online/offline toggle works normally afterward — approval sets the initial state, it does **not** pin them online. The matching query is unchanged and still requires `availability_status='online'`, so "online = genuinely available" holds.

---

## 4. SMS notifications for drivers

New swappable `SMS_DRIVER` (`stub | africastalking`), mirroring `MAIL_DRIVER`/`PUSH_DRIVER`. The stub logs (runs now, no credentials); the real driver is Africa's Talking (Rwanda-supported), selected by env. Drivers get an SMS on a new job proposal, alongside the push — SMS suits drivers better in this market than email.

```
SMS_DRIVER=stub            # or africastalking
AT_USERNAME=  AT_API_KEY=  AT_SENDER_ID=
```

---

## 5. Admin moderation actions

Admins were read-only except verification review. Added (each admin-guarded and audit-logged):

- **Force a driver offline** (moderation; going online stays driver-only since it needs the driver's real location).
- **Suspend / reactivate a user** — a suspended user can't log in, and a suspended driver is excluded from matching. New nullable `users.suspended_at` (migration `1721000000000-UserSuspension`), enforced in auth login and the matching query.
- **Cancel any non-terminal job.**
- **Re-open an already-decided verification** back to pending.

---

## 6. Mobile UX / matching fixes (notable)

- **Rwanda phone input** normalised to E.164 (`0788…`/`788…`/`+250…` → `+250…`).
- **Browse drivers without a posted job** — the Nearby tab works standalone (see supply before committing, like ride-hailing apps); shows a driver list below the map so overlapping same-point pins are all still visible/tappable.
- **Distinct icons per vehicle type** (moto/pickup/van/trucks) on pins + list.
- **Nearby filter** no longer silently hides online drivers of other vehicle types (browse defaults to "all"); no longer resets to a job's type on reload.
- **Fixes:** job-selection dropdown crash (keyed on job id, not Job identity); background polls no longer crash on a network timeout; owner lands on the job detail after sending a proposal (with 15s background status polling); create-job form surfaces validation errors instead of failing silently.

---

## Testing status

API unit suite: **58 tests** across 8 suites (was 47) — includes pricing v3 weight cases, verification auto-activate, and SMS provider tests. Plus one real PostGIS integration test. Admin (Vitest) 9, mobile (flutter_test) ~20+.
