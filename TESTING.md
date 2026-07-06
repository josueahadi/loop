# Loop — Testing

How Loop is tested: the automated suites in each package, the strategies behind
them, the manual end-to-end matrix, and the device/environment constraints that
shape what can be verified where.

## Test strategies

Loop is a three-tier system (Flutter mobile · NestJS API · Next.js admin), so
testing is layered by what each tier owns:

| Strategy | Where | What it covers |
| --- | --- | --- |
| **Unit** | api, admin, mobile | Pure logic in isolation with collaborators mocked — the pricing formula, the proposal accept/decline state machine, auth password handling, query builders, display formatters. |
| **Widget** | mobile | Individual screens/widgets render and accept input (login, signup, onboarding, cards, search bar). |
| **Integration (live API)** | api | Endpoints exercised against a running API + real PostGIS during development — the pricing/geo queries and the full auth → verify → match → propose → accept → chat → complete → rate loop. |
| **Manual end-to-end** | all | The cross-app product loop driven by hand across two accounts (owner + driver) plus admin — see the matrix below. |
| **Deployment verification** | api, admin | A checklist run against the **hosted** stack after each deploy — see [DEPLOYMENT.md §9](DEPLOYMENT.md#9-verification-in-the-target-environment). |

The automated suites deliberately target the **custom logic** — the rule-based
pricing algorithm, the match/proposal safety guards, and the auth security
boundary — because that is where correctness matters most and where a mock-based
unit test is both fast and meaningful. Geo-distance itself is delegated to
PostGIS (`ST_Distance`), so it's verified by integration against a real database
rather than re-implemented and unit-tested.

## Running the suites

```bash
# API (Jest) — pricing formula, proposal state machine, auth
cd api && npm test              # or: npm run test:cov  for coverage

# Admin (Vitest) — pagination query builder, metrics formatters
cd admin && npm test

# Mobile (Flutter) — model, screen, and widget tests
cd mobile && flutter test
```

### What's covered

**API (`api/src/**/*.spec.ts`)**
- `pricing.service.spec.ts` — the formula `base_fare + (rate_per_km × distance_km) × size_factor`: base-fare-only at zero distance, size-multiplier scaling, whole-RWF rounding (zero-decimal currency), and the "no config" / "no multiplier" error paths.
- `proposals.service.spec.ts` — accept/decline guards: wrong-driver rejection, missing proposal, conflict when the job is already matched, conflict on re-responding with a different status, idempotent re-decline, decline-notifies-owner, and accept-runs-in-a-transaction (which auto-declines the other pending proposals).
- `auth.service.spec.ts` — rejects unknown email / wrong password, issues tokens on success, audits **admin** logins (not regular users), forces `cargo_owner` when someone tries to self-register as admin, and never stores a plaintext password (argon2 hash).

**Admin (`admin/src/**/*.test.ts`)**
- `pagination.test.ts` — `directoryQuery` always sends page/limit and only adds trimmed, non-empty search/filter.
- `format.test.ts` — the metrics formatters render values correctly and show **"No data yet"** for null (never a fabricated `0%` / `0`).

**Mobile (`mobile/test/`)**
- Model tests (JSON round-trip), screen tests (login/signup/onboarding render + inputs), and widget tests (stats card, vehicle card, search bar).

## Manual end-to-end matrix

The core product loop spans two roles and the admin, so it's driven by hand
across accounts. Point the mobile app at the API (`--dart-define=API_BASE_URL=…`)
and the admin at the same API.

| # | Flow | Actors | Expected |
| --- | --- | --- | --- |
| 1 | Register + log in | owner, driver | JWT issued; session survives app restart |
| 2 | Driver verification | driver, admin | Driver uploads licence/ID/vehicle-reg → admin approves/rejects (with a reason) → driver sees the decision (email + in-app) |
| 3 | Go online (gated) | driver | Only a verified **and** online driver appears in matching |
| 4 | Create job + estimate | owner | Pick pickup/drop-off (search, current location, or pin) → system shows an estimated price → owner sets the price |
| 5 | Nearby matching | owner | Owner sees nearby available verified drivers, filtered by vehicle type, ordered by proximity |
| 6 | Propose + respond | owner, driver | Owner sends a proposal at the posted price → driver accepts or declines (no negotiation) → other proposals auto-decline on accept |
| 7 | Messaging | owner, driver | Chat opens on acceptance; messages deliver in real time |
| 8 | Navigation hand-off | driver | "Open in Maps" deep-links pickup/drop-off to the device's maps app |
| 9 | Complete + rate | owner, driver | Job completes; both leave a two-way rating; averages update |
| 10 | Admin directory + metrics | admin | Drivers/users/jobs directories paginate + filter; server-computed metrics render |

### Testing with different data values

- **Locations:** set the emulator/simulator to different Kigali points (Remera, Kimironko, CBD, Nyabugogo, airport) to vary distance/proximity — see [mobile/README.md → Setting a test location](mobile/README.md#setting-a-test-location-kigali). Pickup/drop-off across the city exercises the pricing distance term and the nearby-driver ordering.
- **Vehicle types & sizes:** each `vehicle_type` (`moto, pickup, van, small_truck, large_truck`) has its own base fare + rate, and each `size` (`small/medium/large`) its own multiplier — vary both to confirm the estimate changes accordingly.
- **Verification states:** approved vs rejected (with/without a note) vs pending — confirm matchability gating and the driver-facing status.
- **Edge inputs:** zero-distance job (pickup == drop-off), a driver with no vehicle, an already-matched job, re-responding to a proposal.

## Environment & device constraints

What can be verified where — a functional flow runs on emulators/simulators, but
some capabilities need real hardware:

| Capability | Android emulator | iOS simulator | Real device |
| --- | --- | --- | --- |
| **Location** | Manual fix (`adb … emu geo fix` / UI); no movement | Manual (Features → Location) | Real GPS; walk a route |
| **FCM push** | ✅ (image must include Google Play services) | ❌ no remote push | Android ✅ · iOS needs a paid Apple APNs key |
| **Camera** (doc upload) | Emulated; use gallery/file picker | No camera; use photo library | Real camera |
| **Performance** | Host-CPU-bound | Host-bound | True device perf (test low-end too) |
| **"Open in Maps"** | Only apps on the image resolve | Apple Maps | All installed maps apps |

Detailed emulator setup (AVD with a Play-services image) and the location table
are in [mobile/README.md](mobile/README.md#android-emulator).

## Post-deploy verification

After deploying, the hosted stack is checked with the runnable checklist in
[DEPLOYMENT.md §9](DEPLOYMENT.md#9-verification-in-the-target-environment) — API
health, auth round-trip, document signed-URLs, email, and the interactive
product loop driven from the admin + mobile against the live API.
