# Loop — Build Spec

Engineering distillation of the proposal for implementation. Stack-agnostic on purpose: the REST resources, entities, and screens hold regardless of framework. **Locked stack:** Flutter for mobile (state via `provider`), a **Next.js** admin, NestJS for the API (NestJS-issued JWT auth, SendGrid email), PostgreSQL + PostGIS, `flutter_map`/OpenStreetMap for maps, and Firebase Storage for documents (Firebase is Storage + push only — not identity). Pair this with `CLAUDE.md` (scope + guardrails) and `loop_diagrams_as_code.md` (the diagrams).

## 1. MVP feature set (what "done" means)
1. **Auth & role-based profiles** — NestJS-issued JWT: register, login, JWT + refresh, password reset, and email verification (email via SendGrid); role = cargo_owner or driver; edit profile.
2. **Driver verification** — driver uploads licence / national ID / vehicle registration; admin approves or rejects; only approved drivers can go online.
3. **Vehicle management (driver)** — add/edit vehicles (type, capacity, reg no, photo).
4. **Availability (driver)** — online/offline toggle + current location.
5. **Geo-matching (owner)** — map view of nearby available verified drivers, filtered by vehicle type, ordered by proximity.
6. **Cost estimate** — compute an *estimated cost* from route + vehicle type + size/weight; the owner reviews it, then sets the price (UI label: Estimated cost ~X RWF).
7. **Job posting (owner)** — set pickup & drop-off by **place/landmark search, current location, or dropping/dragging a pin** (OSM geocoder: Photon search + Nominatim reverse, no Google); a pin can carry a reverse-geocoded label + a free-text note. Then post the price + load profile (size, weight, type, pickup, drop-off, required vehicle type).
8. **Proposals** — owner selects a driver and sends a proposal at the posted price; driver accepts or declines.
9. **Messaging & contact** — in-app thread opens on acceptance (real-time via a NestJS WebSocket gateway, polling fallback, messages stored in Postgres); plus a `tel:` **call button** and an **"Open in Maps"** navigation hand-off that launches the driver's own Google Maps / Apple Maps / Waze via a `geo:` / Maps-URL deep link (no in-app routing, no Maps SDK, no API key, does not invoke Google's Maps TOS). Contact details (phone) are revealed only **after** a proposal is accepted — not browsable beforehand.
10. **Two-way ratings** — both parties rate after completion; aggregate shown on profile.
11. **Admin (separate Next.js app)** — a verification review queue (approve / reject) **and a metrics dashboard** surfacing the evaluation metrics are the must-haves; read-only lists of users and jobs for oversight are a nice-to-have.

### Out of scope — payments (future work only)
Payments are **fully out of scope**. Loop never processes, holds, or records payment — no MoMo/USSD dial shortcut, no card/PSP integration, no escrow. Parties settle payment offline, out of band. The MoMo USSD flow and card payments are cited in **future work only**. See also the out-of-scope list in `CLAUDE.md`.

### Stretch — post-core polish (optional, NOT MVP-done)
These are perception/UX upgrades that ride on infrastructure the MVP already has. I will build them **only after the core loop (M4) and trust (M5) are done**.
- **Live driver position (owner map).** After a proposal is accepted, the owner watches the assigned driver's marker move toward the pickup, over the **existing M4 WebSocket gateway**. Scoped tightly: only post-acceptance, only for the active job, **stops at completion**; shows the live dot + **straight-line distance** ("driver ~800 m away") — never a road ETA (that would need routing, which stays out).
- **Abstracted / minimal basemap.** Swap the default OSM raster tiles for a muted OSM-based basemap (CartoDB "Positron" / a Stadia/MapTiler *light* style) plus clean custom markers, for an Uber-like look. Raster-only — **no vector tiles, no map SDK**; check the basemap provider's free-tier terms + attribution.

## 2. Data model
Types are indicative; map to the repo's ORM/migrations. IDs are UUIDs unless the repo says otherwise.

**USER** — `user_id` (PK), `name`, `phone`, `email`, `password_hash`, `role` [cargo_owner | driver | admin], `photo`, `created_at`. Driver-only: `availability_status` [online | offline], `current_lat`, `current_lng`, `average_rating`.

**VEHICLE** — `vehicle_id` (PK), `driver_id` (FK→USER), `type` [moto | pickup | van | small_truck | large_truck], `capacity`, `reg_no`, `photo`.

**Vehicle-type taxonomy (canonical).** The five `VehicleType` values are **capacity buckets, not vehicle makes** — a driver picks the bucket their vehicle *fits*, not its exact model. Identical across DB, API, both clients, and `pricing_config`.
- **moto** — motorcycle or cargo bike; small parcels / very light loads.
- **pickup** — single- or double-cab pickup (Hilux-class).
- **van** — panel van or minibus-based cargo (Hiace-class).
- **small_truck** — light truck, roughly ≤ 3–5 tonnes (Canter-class).
- **large_truck** — heavy truck / lorry, above light-truck capacity (catch-all for the heaviest loads).

Present it as a **dropdown with a short capacity/example hint under each option** — not a free-text field, and **no "Other" option**: every vehicle must map to a rate-able, filterable bucket, or matching (the filter), pricing (`rate_per_km` per type), and the results-chapter analysis all break. If a vehicle seems not to fit, **widen a bucket's definition** (e.g. `large_truck` = anything heavier than a light truck) rather than adding "Other". Specialised rigs (tankers, flatbed trailers, refrigerated units) are out of MVP scope and are a clean future-work line. **Validate these five against real Kigali demand before M3 seeds `rate_per_km`** — the enum is canonical across four places, so changing it later is a coordinated migration.

**JOB** — `job_id` (PK), `owner_id` (FK→USER), `pickup`, `drop_off` (PostGIS geography points), `pickup_label`, `drop_off_label` (nullable, reverse-geocoded display text), `pickup_notes`, `drop_off_notes` (nullable free text, e.g. "blue gate, 2nd house"), `cargo_type`, `size`, `weight`, `estimated_price`, `price`, `req_vehicle_type`, `status` [draft | posted | matched | in_progress | completed | cancelled], `created_at`, plus status-transition timestamps `posted_at`, `matched_at`, `accepted_at`, `in_progress_at`, `completed_at`, `cancelled_at` (columns on JOB — no separate event table).

**PROPOSAL** — `proposal_id` (PK), `job_id` (FK→JOB), `driver_id` (FK→USER), `status` [sent | accepted | declined], `created_at`.

**MESSAGE** — `message_id` (PK), `job_id` (FK→JOB), `sender_id` (FK→USER), `receiver_id` (FK→USER), `content`, `sent_at`.

**RATING** — `rating_id` (PK), `job_id` (FK→JOB), `from_user_id` (FK→USER), `to_user_id` (FK→USER), `score` [1–5], `comment`, `created_at`.

**VERIFICATION_RECORD** — `record_id` (PK), `driver_id` (FK→USER), `document_type` [licence | national_id | vehicle_reg], `storage_reference`, `status` [pending | approved | rejected], `reviewed_by` (FK→USER, an admin), `reviewed_at`.

Relationships: USER 1—N VEHICLE; USER(owner) 1—N JOB; JOB 1—N PROPOSAL; USER(driver) 1—N PROPOSAL; JOB 1—N MESSAGE; JOB 1—(0..2) RATING; USER 1—N RATING; USER(driver) 1—N VERIFICATION_RECORD. Use PostGIS geography/geometry for driver location to support nearby queries.

## 3. REST API surface (indicative)
- **Auth (NestJS-issued JWT):** `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`, `POST /auth/verify-email`, `GET /me`, `PATCH /me`. Passwords hashed (bcrypt/argon2); reset + verification emails via SendGrid.
- **Verification:** `POST /verification` (driver upload), `GET /verification` (own); admin: `GET /admin/verifications?status=pending`, `PATCH /admin/verifications/:id` (approve/reject)
- **Vehicles:** `GET /vehicles`, `POST /vehicles`, `PATCH /vehicles/:id`, `DELETE /vehicles/:id`
- **Availability:** `PATCH /me/availability` `{ status, lat, lng }`
- **Matching:** `GET /drivers/nearby?lat=&lng=&vehicle_type=` → available, approved drivers ordered by distance
- **Pricing:** `POST /pricing/estimate` `{ pickup, drop_off, vehicle_type, size, weight }` → `{ estimated_price, distance_km }`
- **Geocoding (OSM proxy):** `GET /geocode/search?q=&limit=` → place/landmark suggestions `[{ label, lat, lng }]` (Photon, biased to Kigali); `GET /geocode/reverse?lat=&lng=` → `{ label }` (Nominatim). Thin proxy so the provider is swappable and OSM's usage policy (custom User-Agent, attribution, ~1 req/s) is enforced server-side; results are OSM-licensed (show "© OpenStreetMap contributors"). No routing endpoint — navigation is handed off client-side to the driver's maps app.
- **Jobs:** `POST /jobs`, `GET /jobs` (own), `GET /jobs/:id`, `PATCH /jobs/:id` (status transitions)
- **Proposals:** `POST /jobs/:id/proposals` (owner → driver), `GET /proposals` (driver: incoming), `PATCH /proposals/:id` (accept/decline)
- **Messages:** `GET /jobs/:id/messages`, `POST /jobs/:id/messages`; real-time delivery over a NestJS WebSocket gateway (Socket.IO), Postgres being the source of truth.
- **Ratings:** `POST /jobs/:id/ratings`, `GET /users/:id/ratings`
- **Admin metrics:** `GET /admin/metrics` → server-computed evaluation metrics (time-to-match, estimate-acceptance rate, in-app coordination rate, empty-trip change, verification completion). Aggregation lives in the API; the dashboard only renders.

## 4. Screen inventory (map each to a Figma frame)
1. Splash / auth (login + register)
2. Role selection (cargo owner / driver)
3. Driver — verification upload
4. Driver — vehicle management
5. Driver — availability toggle + incoming proposals
6. Owner — home map (nearby drivers + vehicle-type filter)
7. Owner — create job (set pickup/drop-off via **search box + current-location + pin**, with reverse-geocoded labels & notes → enter details → **see estimated cost** → adjust price → post)
8. Owner — select driver + send proposal
9. Job / proposal detail (status timeline; **"Open in Maps"** to navigate to pickup/drop-off)
10. Chat thread
11. Rating screen
12. Admin — verification queue **(separate Next.js app, not part of the mobile app)**
13. Admin — metrics dashboard: KPI cards + charts for the evaluation metrics

When the Figma is connected, map every frame to one of these and note any screens in Figma that fall outside the MVP (defer them).

## 5. Pricing logic
`estimated_price = base_fare + ( rate_per_km(vehicle_type) × distance_km ) × size_factor`
- `distance_km`: **great-circle distance computed in PostGIS** between pickup and drop-off (`ST_Distance` on `geography` points) — no routing API. A routing-based distance can be added later. Turn-by-turn navigation isn't computed in-app either; the driver's external maps app handles it (see §6, M4).
- `base_fare`, `rate_per_km(vehicle_type)`, `size_factor`: configuration (a table/JSON), seeded from field research, editable without redeploy.
- Returned by `POST /pricing/estimate`; the owner can override before posting. Store both `estimated_price` and the final `price` on the JOB so you can measure how often the estimate is accepted unchanged.

## 6. Suggested build order (maps to the Jun–Aug timeline)
- **M1 — Foundation:** repo reconciliation (clean copy `cargo--App` → `mobile/`, `git init` the monorepo), DB schema + migrations (include the JOB **status-transition timestamps** and both `estimated_price` and `price`, so metrics data accumulates from day one), **NestJS-issued JWT auth** (register/login/refresh/password-reset/email-verification, `JwtAuthGuard` + `RolesGuard`, SendGrid email with a console-log stub until the sender is verified), role-based profiles, **seed the admin account**, driver verification + admin approval. Strip the out-of-scope business-credential fields and the payment widget from the existing app.
- **M2 — Matching:** availability + location capture (add `geolocator`), PostGIS nearby-driver query (`ST_DWithin`/`ST_Distance`, gated on approved AND online, default radius 10 km), `flutter_map` + OpenStreetMap map view + vehicle-type filter, vehicle CRUD.
- **M3 — Pricing + jobs:** pricing estimate endpoint + config, job creation with the estimated cost shown to the owner, posting.
- **M3.5 — Location search & navigation (small addition, before M4):** OSM geocoding proxy (`GET /geocode/search` via Photon, `GET /geocode/reverse` via Nominatim, Kigali-biased, server-side User-Agent + attribution); create-job gains a debounced **place/landmark search box** plus reverse-geocoded pin labels and a notes field — keeping current-location and pin-drag as-is; add JOB `*_label` / `*_notes` columns via migration; add a reusable **"Open in Maps"** action (via `map_launcher`/`url_launcher`) on the owner job detail. Spike-test ~10 real Kigali locations against Photon before wiring the UI; the pin-drop remains the fallback for anything missing.
- **M4 — Transaction loop:** first-class proposals (send / accept / decline, no negotiation), in-app messaging (Postgres + NestJS WebSocket gateway, polling fallback), a **`tel:` call button** with the counterparty's phone revealed **only after a proposal is accepted**, FCM push for new proposal / accept-decline / new message; reuse the **"Open in Maps"** hand-off on the driver's job/proposal detail so the driver can navigate to pickup/drop-off post-acceptance.
- **M5 — Trust:** two-way ratings + reputation aggregation on profiles.
- **M6 — Evaluation:** build the **Next.js metrics dashboard** over `GET /admin/metrics` (data already accumulating since M1), polish, run the Kigali user test.

**Stretch (do only after M4–M5 are green; optional demo polish):**
- **S1 — Minimal basemap:** point `flutter_map` at a muted OSM-based tile source (CartoDB Positron / a *light* style) and add clean custom markers (blue "you" dot, green vehicle pins). Small, high-impact; raster-only, no vector tiles, no SDK, no key beyond a basemap provider's free tier (respect its terms + attribution). Safe to do independently at any point.
- **S2 — Live driver position:** while a job is active (post-acceptance → completion), the driver's app emits its location on an interval to the **M4 WebSocket gateway**, which broadcasts to the owner subscribed to that job; the owner's marker animates. Bound it to the active job (start on acceptance, **stop on completion**) to protect battery and privacy — never expose a driver's live position before a match. Show the dot + straight-line distance, **no ETA/routing**.

## 7. Metrics to instrument (for the results chapter)
- Verification task completion & accuracy; profile completeness.
- Availability of ≥1 matching driver within the radius; **time-to-match**.
- **Share of jobs posted at the estimated cost unchanged** (estimate-acceptance rate); effect of the estimate on time-to-acceptance.
- Proportion of post-match coordination conducted in-app.
- Pre/post change in trust perception; self-reported empty-trip frequency.

Computed server-side and exposed via `GET /admin/metrics`, then rendered in the admin dashboard — the same numbers feed the results chapter.

## 8. Non-functional notes
- **Auth:** NestJS-issued JWT. Postgres `USER` holds `password_hash` (bcrypt/argon2) — no Firebase Auth. Short-lived access tokens + refresh; single-use, expiring password-reset and email-verification tokens; `JwtAuthGuard` + `RolesGuard` protect every route by role.
- **Admin:** seed one `admin` account via migration/config — no public admin signup. The **Next.js** admin authenticates against the same NestJS API; all `/admin/*` routes are `admin`-only.
- **Gating:** a driver appears in matching only if verification = approved AND availability = online.
- **Privacy:** a user's phone number is revealed to the counterparty only **after** a proposal is accepted — not browsable beforehand.
- **Storage:** verification documents go to Firebase Storage **via the API** (no public bucket); Postgres stores only `storage_reference`. Documents are sensitive (licences, national IDs).
- **Money:** RWF is zero-decimal — store **integer whole francs**, never float, never ×100.
- Push notifications (FCM) for new proposals, accept/decline, and new messages.
- **Live location (stretch S2):** a driver's continuous position is shared **only** while a job of theirs is active (accepted → completed) and is visible only to that job's owner — never before a match, never after completion. Emit on a sensible interval and stop promptly, to bound battery drain and respect driver privacy.

## 9. Project structure & conventions (DRY, feature-based)
`flutter create`, `nest new`, and `create-next-app` scaffold the baseline (`lib/`, `src/`, `app/`, configs, entrypoints) but do **not** impose an internal architecture. The feature-based, DRY layout below is the convention to scaffold into. Top level (monorepo):

```
loop/
├── mobile/   Flutter
├── admin/    Next.js
├── api/      NestJS
└── docs/
```

### mobile/ — Flutter, feature-first
```
mobile/lib/
├── main.dart
├── app.dart                  # MaterialApp, router + theme wiring
├── core/                     # shared across features (DRY)
│   ├── api/                  # ONE Dio client + interceptors (auth, errors)
│   ├── config/               # env, constants
│   ├── theme/                # colours, typography — single source of truth
│   ├── routing/
│   ├── errors/
│   ├── widgets/              # shared reusable widgets
│   └── utils/                # formatters, validators
├── features/                 # one folder per feature
│   ├── auth/  onboarding/  matching/  jobs/  proposals/  messaging/  ratings/  profile/
│   └── <feature>/{data, presentation}     # add domain/ only if a feature truly needs it
└── shared/models/            # API models (prefer generating from OpenAPI — see below)
```
State management is **`provider`** (the existing app's choice) — used consistently across every feature; do not migrate to Riverpod/Bloc.

### api/ — NestJS, module per feature
```
api/src/
├── main.ts
├── app.module.ts
├── common/                   # cross-cutting (DRY)
│   ├── guards/               # JwtAuthGuard, ONE RolesGuard reused everywhere
│   ├── decorators/           # @Roles, @CurrentUser
│   ├── filters/  interceptors/  pipes/  dto/   # exception filter, validation, pagination
├── config/                   # env config + validation
├── database/                 # data source, migrations, seeds (seed the admin here)
└── modules/
    ├── auth/  users/  verification/  vehicles/  matching/  pricing/
    ├── jobs/  proposals/  messaging/  ratings/  admin/
    └── <feature>/{<feature>.module.ts, .controller.ts, .service.ts, entities/, dto/}
```
ORM: **TypeORM** has native PostGIS `geometry`/`geography` columns (simplest for the matching query); Prisma also works but use raw SQL for the geo parts. Metrics aggregation lives in the `admin` module (`admin.service` → `GET /admin/metrics`). A shared `mail` service wraps SendGrid (with a console-log stub for dev) and is reused by `auth`; a `notifications` helper wraps FCM; the `messaging` module hosts the WebSocket gateway for real-time chat.

### admin/ — Next.js, feature-based (App Router as a thin routing shell)
```
admin/src/
├── app/                      # routing ONLY — pages import from features/
│   ├── login/page.tsx
│   └── (dashboard)/{verifications, metrics, users, jobs}/page.tsx
├── features/                 # the real code, one folder per feature (DRY)
│   ├── auth/  verifications/  metrics/  users/  jobs/
│   └── <feature>/{components, hooks, api, types.ts}
├── components/ui/            # shared design-system primitives (e.g. shadcn/ui)
├── lib/                      # ONE API client to NestJS, auth, query client, utils
└── types/                    # shared types (generate from the API — see below)
```
Data layer: **TanStack Query** via per-feature hooks (`useVerifications`, `useMetrics`) over the single API client; a chart lib (e.g. Recharts) for the dashboard. `react-admin` is opinionated and fights a custom `features/` layout; **Refine** tolerates it if you want CRUD scaffolding.

### DRY backbone across all three apps
The biggest duplication risk is the API contract. Make NestJS the single source of truth:
- Enable OpenAPI in NestJS (`@nestjs/swagger`).
- **Generate** the clients: Next.js types via `openapi-typescript` (or `orval`), Flutter models via `openapi-generator` (`dart-dio`).
- Change a DTO once in the API → both clients regenerate. No hand-copied models in three places.

---

## Appendix A — Stretch build prompts (S1, S2)

Ready-to-paste Claude Code prompts for the stretch items in §6. **Give them only after M4–M5 are green** (S1 is safe any time once M2's map exists; S2 needs the M4 WebSocket gateway). Scope and rationale live in §1 (Stretch) and §6 (S1/S2); these are just the build instructions.

### S1 — Minimal / abstracted basemap

```text
Stretch S1 (per docs/BUILD_SPEC §6): give the map an abstracted, Uber-like look. Small, raster-only,
no new infrastructure. Branch feat/mobile-basemap, tag when merged.

- Point flutter_map's TileLayer at a muted OSM-based basemap instead of standard OSM tiles — use a
  CartoDB "Positron" / light style (e.g. the light_all raster endpoint) or a Stadia/MapTiler *light*
  style. Put the tile URL + attribution string in core/config so it's swappable; do NOT hardcode it in
  widgets. NO vector tiles, NO map SDK, NO Google.
- Show the required attribution ("© OpenStreetMap contributors, © CARTO" or the chosen provider's) on
  the map, per their terms.
- Replace the default markers with clean custom ones used consistently on both maps (owner Nearby map +
  create-job pins): a blue "you" dot, green vehicle pins, distinct pickup/drop-off pins. Keep the
  existing straight green line between pins.
- If the basemap provider needs a key/account for its tiles, read it from --dart-define / env, never
  commit it; if you can stay fully keyless (CartoDB basemaps are free for reasonable use with
  attribution), prefer that.

Verify the map renders with the muted style on device and attribution is visible. Conventions unchanged:
self-documenting code, conventional commits, no AI/co-author trailer.
```

### S2 — Live driver position (owner map)

```text
Stretch S2 (per docs/BUILD_SPEC §6 + §8, and CLAUDE.md Stretch): the cargo owner sees the assigned
driver's live position move toward pickup after acceptance. Reuse the M4 WebSocket gateway — do NOT add
new realtime infrastructure. Branch feat/live-driver-location, tag when merged. Respect the
privacy/battery scoping exactly.

Scope (hard rules):
- Live location is shared ONLY while a job of the driver's is active: starts when a proposal on that job
  is accepted, STOPS on completion (or cancellation). Never before a match, never after completion.
- Visible only to that job's owner. A driver's live position is never exposed to browsing owners.
- Show the driver's marker + straight-line distance to pickup (PostGIS/great-circle), e.g. "driver
  ~800 m away". NO road ETA, NO routing — routing stays out of scope.

Backend (NestJS, on the existing gateway):
- Add a job-scoped location channel/room on the M4 WebSocket gateway. The driver's app emits
  { jobId, lat, lng } on an interval while the job is active; the gateway authorizes (sender is the
  accepted driver on that job) and broadcasts to the room the job's owner has joined.
- Persist the latest position on the driver (already have users.location as geography(Point,4326)) —
  reuse it; do not add an event/history table.
- Guard the room: only the job's owner may subscribe to that job's location; only the assigned driver
  may publish. Reject otherwise.

Mobile (Flutter, provider, reuse the gateway client):
- Driver side: while a job is active, emit location on an interval (e.g. every 5-10s) using geolocator;
  STOP the stream on completion/cancellation and on leaving the screen/going offline — bound battery.
- Owner side: on the active-job detail, subscribe to the job's location channel and animate the driver's
  marker as updates arrive; show straight-line distance to pickup. Fall back gracefully if no update
  arrives (show last-known + a subtle "updating..."), and unsubscribe on completion/leaving the screen.
- Use the S1 custom markers if S1 is already in.

Verify: only the assigned driver can publish and only the owner can subscribe (authorization enforced);
the stream starts on acceptance and stops on completion; distance is straight-line; no routing calls.
Conventions unchanged.
```