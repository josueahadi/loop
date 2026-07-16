# Loop: Build Spec

Engineering distillation of the proposal for implementation. The REST resources, entities, and screens are stack-agnostic and hold regardless of framework. **Locked stack:** Flutter for mobile (state via `provider`), a **Next.js** admin, NestJS for the API (NestJS-issued JWT auth, SendGrid email), PostgreSQL with PostGIS, `flutter_map`/OpenStreetMap for maps, and Firebase Storage for documents (Firebase provides Storage and push only, not identity).

## Contents

1. [MVP feature set (what "done" means)](#1-mvp-feature-set-what-done-means)
2. [Data model](#2-data-model)
3. [REST API surface (indicative)](#3-rest-api-surface-indicative)
4. [Screen inventory](#4-screen-inventory)
5. [Pricing logic](#5-pricing-logic)
6. [Suggested build order](#6-suggested-build-order-maps-to-the-junaug-timeline)
7. [Metrics to instrument](#7-metrics-to-instrument-for-the-results-chapter)
8. [Non-functional notes](#8-non-functional-notes)
9. [Project structure & conventions](#9-project-structure--conventions-dry-feature-based)
10. [Appendix: Stretch features (S1, S2)](#appendix-stretch-features-s1-s2)

## 1. MVP feature set (what "done" means)
1. **Auth & role-based profiles:** NestJS-issued JWT covering register, login, JWT plus refresh, password reset, and email verification (email via SendGrid); role is cargo_owner or driver; profile is editable.
2. **Driver verification:** a driver uploads licence, national ID, and vehicle registration; an admin approves or rejects; only approved drivers can go online.
3. **Vehicle management (driver):** add and edit vehicles (type, capacity, registration number, photo).
4. **Availability (driver):** an online/offline toggle plus current location.
5. **Geo-matching (owner):** a map view of nearby available verified drivers, filtered by vehicle type, ordered by proximity.
6. **Cost estimate:** an estimated cost computed from route, vehicle type, and size/weight; the owner reviews it, then sets the price (UI label: Estimated cost ~X RWF).
7. **Job posting (owner):** pickup and drop-off are set by place/landmark search, current location, or dropping/dragging a pin (OSM geocoder: Photon search plus Nominatim reverse, no Google); a pin can carry a reverse-geocoded label and a free-text note. The owner then posts the price plus the load profile (size, weight, type, pickup, drop-off, required vehicle type).
8. **Proposals:** the owner selects a driver and sends a proposal at the posted price; the driver accepts or declines.
9. **Messaging & contact:** an in-app thread opens on acceptance (real-time via a NestJS WebSocket gateway with a polling fallback, messages stored in Postgres), alongside a `tel:` call button. Contact details (phone) are revealed only after a proposal is accepted, never browsable beforehand.
12. **Navigation (driver, post-acceptance):** in-app turn-by-turn over OSRM + `flutter_map` — route polyline, follow-me camera, voice guidance, off-route rerouting (see [section 1 → Routing & in-app navigation](#routing--in-app-navigation-m7--in-scope)). An "Open in Maps" deep link to the driver's own Google Maps / Apple Maps / Waze remains as a secondary preference and as the fallback when OSRM is unreachable. No Maps SDK, no API key, no Google Maps TOS obligation.
10. **Two-way ratings:** both parties rate after completion; the aggregate is shown on the profile.
11. **Admin (separate Next.js app):** a verification review queue (approve/reject) and a metrics dashboard surfacing the evaluation metrics are the must-haves; read-only lists of users and jobs for oversight are a nice-to-have.

### Out of scope: payments (future work only)
Payments are fully out of scope. Loop never processes, holds, or records payment: no MoMo/USSD dial shortcut, no card/PSP integration, no escrow. Parties settle payment offline, out of band. The MoMo USSD flow and card payments are cited in future work only.

### Routing & in-app navigation (M7 — in scope)
**Scope revision (supervisor-directed).** Road routing and in-app turn-by-turn were previously
future work, on the reasoning that navigation needs a proprietary, metered SDK. **OSRM removes that
objection**: it is OpenStreetMap-native, needs no API key, is licence-compatible with the OSM
basemap already in use, and is self-hostable. Both are now in scope and delivered in **M7**.

- **Road distance & duration for the estimate.** `distance_km` comes from OSRM road routing rather
  than the great-circle line, and the route's `duration_min` becomes a *priced* input — see
  [section 5](#5-pricing-logic). The great-circle (PostGIS) result stays as the **fallback** when
  OSRM is unreachable, flagged via `distance_source` so an estimate is never blocked on a third
  party.
- **In-app turn-by-turn (driver, post-acceptance).** A full-screen `flutter_map` navigation screen:
  route polyline, follow-me camera on the live GPS stream, an instruction banner with a live
  distance countdown, remaining distance/ETA, off-route detection with a single guarded reroute,
  and English voice guidance (`flutter_tts`). The screen keeps the device awake (`wakelock_plus`)
  and releases the location stream and the wakelock on arrival, on exit, and on job
  completion/cancel.
- **"Open in Maps" is demoted to a secondary fallback.** The `geo:`/Maps-URL deep link to Google
  Maps / Apple Maps / Waze remains, as a driver-preference "Use another app" option and as the
  graceful degradation path when OSRM is unreachable. This mirrors Uber's model — built-in
  navigation with a third-party hand-off — rather than replacing one with the other.
- **Provider stance is unchanged:** no Google, no Mapbox SDK, no API key. OSRM's base URL is
  configuration, so the public demo server can be swapped for a self-hosted Rwanda extract as a
  config change, not a rewrite.

### Stretch: post-core polish (optional, not MVP-done)
These are perception and UX upgrades that ride on infrastructure the MVP already has. They belong after the core loop (M4) and trust (M5) are done.
- **Live driver position (owner map).** After a proposal is accepted, the owner watches the assigned driver's marker move toward the pickup, over the existing M4 WebSocket gateway. It is scoped tightly: only post-acceptance, only for the active job, stopping at completion, and it shows the live dot plus a straight-line distance ("driver ~800 m away") rather than a road ETA (which would need routing, kept out of scope).
- **Abstracted / minimal basemap.** The default OSM raster tiles are swapped for a muted OSM-based basemap (CartoDB "Positron" or a Stadia/MapTiler light style) plus clean custom markers, for an Uber-like look. Raster-only, with no vector tiles and no map SDK, and mindful of the basemap provider's free-tier terms and attribution.

## 2. Data model
Types are indicative and map to the repo's ORM/migrations. IDs are UUIDs unless the repo says otherwise.

**USER:** `user_id` (PK), `name`, `phone`, `email`, `password_hash`, `role` [cargo_owner | driver | admin], `photo`, `created_at`. Driver-only: `availability_status` [online | offline], `current_lat`, `current_lng`, `average_rating`.

**VEHICLE:** `vehicle_id` (PK), `driver_id` (FK→USER), `type` [moto | pickup | van | small_truck | large_truck], `capacity`, `reg_no`, `photo`.

**Vehicle-type taxonomy (canonical).** The five `VehicleType` values are capacity buckets, not vehicle makes: a driver picks the bucket their vehicle fits, not its exact model. The values are identical across the DB, API, both clients, and `pricing_config`.
- **moto:** motorcycle or cargo bike; small parcels and very light loads.
- **pickup:** single- or double-cab pickup (Hilux-class).
- **van:** panel van or minibus-based cargo (Hiace-class).
- **small_truck:** light truck, roughly 3 to 5 tonnes or less (Canter-class).
- **large_truck:** heavy truck or lorry above light-truck capacity (catch-all for the heaviest loads).

The taxonomy is presented as a dropdown with a short capacity/example hint under each option, not a free-text field, and with no "Other" option: every vehicle must map to a rate-able, filterable bucket, or matching (the filter), pricing (`rate_per_km` per type), and the results-chapter analysis all break. A vehicle that seems not to fit is handled by widening a bucket's definition (for example, `large_truck` as anything heavier than a light truck) rather than adding "Other". Specialised rigs (tankers, flatbed trailers, refrigerated units) are out of MVP scope and are a clean future-work line. The five buckets are validated against real Kigali demand before M3 seeds `rate_per_km`, since the enum is canonical across four places and changing it later is a coordinated migration.

**JOB:** `job_id` (PK), `owner_id` (FK→USER), `pickup`, `drop_off` (PostGIS geography points), `pickup_label`, `drop_off_label` (nullable, reverse-geocoded display text), `pickup_notes`, `drop_off_notes` (nullable free text, e.g. "blue gate, 2nd house"), `cargo_type`, `size`, `weight`, `estimated_price`, `price`, `req_vehicle_type`, `status` [draft | posted | matched | in_progress | completed | cancelled], `created_at`, plus status-transition timestamps `posted_at`, `matched_at`, `accepted_at`, `in_progress_at`, `completed_at`, `cancelled_at` (columns on JOB, with no separate event table). **Pricing inputs actually used (M7, nullable):** `distance_km`, `duration_min`, `distance_source` [osrm | great_circle] — persisted because they are the features a future learned pricing model would train on and cannot be reconstructed later.

**PROPOSAL:** `proposal_id` (PK), `job_id` (FK→JOB), `driver_id` (FK→USER), `status` [sent | accepted | declined], `created_at`.

**MESSAGE:** `message_id` (PK), `job_id` (FK→JOB), `sender_id` (FK→USER), `receiver_id` (FK→USER), `content`, `sent_at`.

**RATING:** `rating_id` (PK), `job_id` (FK→JOB), `from_user_id` (FK→USER), `to_user_id` (FK→USER), `score` [1–5], `comment`, `created_at`.

**VERIFICATION_RECORD:** `record_id` (PK), `driver_id` (FK→USER), `document_type` [licence | national_id | vehicle_reg], `storage_reference`, `status` [pending | approved | rejected], `reviewed_by` (FK→USER, an admin), `reviewed_at`.

Relationships: USER 1–N VEHICLE; USER(owner) 1–N JOB; JOB 1–N PROPOSAL; USER(driver) 1–N PROPOSAL; JOB 1–N MESSAGE; JOB 1–(0..2) RATING; USER 1–N RATING; USER(driver) 1–N VERIFICATION_RECORD. Driver location uses PostGIS geography/geometry to support nearby queries.

## 3. REST API surface (indicative)
- **Auth (NestJS-issued JWT):** `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`, `POST /auth/verify-email`, `GET /me`, `PATCH /me`. Passwords are hashed (bcrypt/argon2); reset and verification emails go via SendGrid.
- **Verification:** `POST /verification` (driver upload), `GET /verification` (own); admin: `GET /admin/verifications?status=pending`, `PATCH /admin/verifications/:id` (approve/reject).
- **Vehicles:** `GET /vehicles`, `POST /vehicles`, `PATCH /vehicles/:id`, `DELETE /vehicles/:id`.
- **Availability:** `PATCH /me/availability` `{ status, lat, lng }`.
- **Matching:** `GET /drivers/nearby?lat=&lng=&vehicle_type=` returns available, approved drivers ordered by distance.
- **Pricing:** `POST /pricing/estimate` `{ pickup, drop_off, vehicle_type, size, weight }` returns `{ estimated_price, distance_km }`.
- **Geocoding (OSM proxy):** `GET /geocode/search?q=&limit=` returns place/landmark suggestions `[{ label, lat, lng }]` (Photon, biased to Kigali); `GET /geocode/reverse?lat=&lng=` returns `{ label }` (Nominatim). It is a thin proxy so the provider is swappable and OSM's usage policy (custom User-Agent, attribution, ~1 req/s) is enforced server-side; results are OSM-licensed (with "© OpenStreetMap contributors" shown).
- **Routing (OSRM proxy, M7):** `GET /routing/route?from_lat=&from_lng=&to_lat=&to_lng=&steps=` returns `{ distance_km, duration_min, polyline, distance_source, instructions? }`. With `steps=true` it also returns ordered turn instructions `[{ text, maneuver_type, modifier, street, distance_m, duration_s, lat, lng }]`, with the human-readable `text` composed **server-side** so every client phrases a maneuver identically. It mirrors the geocode proxy: authenticated, provider swappable via config (public OSRM demo server by default; a self-hosted Rwanda extract is a base-URL change), descriptive User-Agent, and raw provider payloads never leaked. If OSRM fails it falls back to the PostGIS great-circle distance with `duration_min: null` and `distance_source: "great_circle"`, so pricing still works.
- **Jobs:** `POST /jobs`, `GET /jobs` (own), `GET /jobs/:id`, `PATCH /jobs/:id` (status transitions).
- **Proposals:** `POST /jobs/:id/proposals` (owner to driver), `GET /proposals` (driver: incoming), `PATCH /proposals/:id` (accept/decline).
- **Messages:** `GET /jobs/:id/messages`, `POST /jobs/:id/messages`; real-time delivery over a NestJS WebSocket gateway (Socket.IO), with Postgres as the source of truth.
- **Ratings:** `POST /jobs/:id/ratings`, `GET /users/:id/ratings`.
- **Admin metrics:** `GET /admin/metrics` returns server-computed evaluation metrics (time-to-match, estimate-acceptance rate, in-app coordination rate, empty-trip change, verification completion). Aggregation lives in the API; the dashboard only renders.

## 4. Screen inventory
1. Splash / auth (login plus register)
2. Role selection (cargo owner / driver)
3. Driver: verification upload
4. Driver: vehicle management
5. Driver: availability toggle plus incoming proposals
6. Owner: home map (nearby drivers plus vehicle-type filter)
7. Owner: create job (set pickup/drop-off via search box, current-location, and pin, with reverse-geocoded labels and notes; enter details; see estimated cost; adjust price; post)
8. Owner: select driver and send proposal
9. Job / proposal detail (status timeline; route polyline with road distance + duration; driver gets "Navigate to pickup" / "Navigate to drop-off")
10. Navigation (driver, post-acceptance only): full-screen turn-by-turn — polyline, follow-me camera, instruction banner + countdown, remaining distance/ETA, voice, and a secondary "Use another app" hand-off
11. Chat thread
12. Rating screen
13. Admin: verification queue (a separate Next.js app, not part of the mobile app)
14. Admin: metrics dashboard, with KPI cards and charts for the evaluation metrics

Every Figma frame maps to one of these; any Figma screen outside the MVP is deferred.

## 5. Pricing logic (v2 — distance *and* time, M7)

```
estimated_price = max( min_fare(vt),
                       base_fare(vt)
                       + rate_per_km(vt)  × distance_km
                       + rate_per_min(vt) × duration_min ) × size_factor
```

Still **rule-based, not ML** — the platform has no transaction history at launch (cold start).

- `distance_km` / `duration_min`: the **road** distance and driving duration from `GET /routing/route`
  (OSRM). **Fallback:** if OSRM is unreachable the PostGIS great-circle distance is used, the
  duration is `null`, and the **time term is omitted** — the response carries `distance_source`
  (`osrm` | `great_circle`) so the degradation is visible rather than silent. An estimate must never
  fail because a third-party router is down.
- `min_fare(vt)`: a floor, so a very short trip still pays for the trip being made at all. It sits
  **inside** the `max()`, so `size_factor` scales the floor too — a bulky short job costs more than a
  small short one.
- `base_fare`, `rate_per_km`, `rate_per_min`, `min_fare` are per-vehicle-type rows in
  `pricing_config`; `size_factor` is a `size_multipliers` row. All are **configuration, editable
  without a redeploy** — never hard-coded. The M7 seeds are **placeholders pending field research**
  and are flagged as such in the migration.
- **RWF is zero-decimal:** every amount is an **integer whole franc**. Rounding to whole RWF happens
  once, at the end.
- Returned by `POST /pricing/estimate`; the owner reviews it and sets the final price — the estimate
  is a **reference, never binding**. Both `estimated_price` and the final `price` are stored on the
  JOB so estimate-acceptance can be measured.
- The `distance_km`, `duration_min`, and `distance_source` actually used are **persisted on the JOB**.
  This is deliberate instrumentation: they are the features a future learned pricing model would
  train on, and they cannot be reconstructed after the fact (road networks and traffic change).

### Deferred: surge / dynamic pricing
Demand-responsive pricing is **explicitly out of scope**, on two grounds. Practically, it needs a
live supply/demand signal that a cold-start platform does not have — there is no density of
concurrent jobs to infer scarcity from, so any multiplier would be invented, not measured.
Principally, it **conflicts with the transparency thesis**: Loop's pitch is that the owner sees one
predictable, owner-set price. A multiplier that moves the number for reasons the owner cannot see is
the opposite of that. It is a clean future-work line once real transaction density exists.

## 6. Suggested build order (maps to the Jun–Aug timeline)
- **M1, Foundation:** repo reconciliation (a clean copy of the existing Flutter app into `mobile/`, then `git init` the monorepo), DB schema plus migrations (including the JOB status-transition timestamps and both `estimated_price` and `price`, so metrics data accumulates from day one), NestJS-issued JWT auth (register/login/refresh/password-reset/email-verification, `JwtAuthGuard` plus `RolesGuard`, SendGrid email with a console-log stub until the sender is verified), role-based profiles, a seeded admin account, and driver verification plus admin approval. Out-of-scope business-credential fields and the payment widget are removed from the existing app.
- **M2, Matching:** availability plus location capture (`geolocator`), the PostGIS nearby-driver query (`ST_DWithin`/`ST_Distance`, gated on approved AND online, default radius 10 km), a `flutter_map` plus OpenStreetMap map view with a vehicle-type filter, and vehicle CRUD.
- **M3, Pricing plus jobs:** the pricing estimate endpoint plus config, job creation with the estimated cost shown to the owner, and posting.
- **M3.5, Location search plus navigation (a small addition before M4):** an OSM geocoding proxy (`GET /geocode/search` via Photon, `GET /geocode/reverse` via Nominatim, Kigali-biased, with a server-side User-Agent and attribution); create-job gains a debounced place/landmark search box plus reverse-geocoded pin labels and a notes field, keeping current-location and pin-drag as-is; JOB `*_label`/`*_notes` columns are added via migration; and a reusable "Open in Maps" action (via `map_launcher`/`url_launcher`) is added on the owner job detail. Around ten real Kigali locations are spike-tested against Photon before the UI is wired; the pin-drop remains the fallback for anything missing.
- **M4, Transaction loop:** first-class proposals (send/accept/decline, no negotiation), in-app messaging (Postgres plus a NestJS WebSocket gateway, with a polling fallback), a `tel:` call button with the counterparty's phone revealed only after a proposal is accepted, and FCM push for a new proposal, an accept/decline, and a new message. The "Open in Maps" hand-off is reused on the driver's job/proposal detail so the driver can navigate to pickup/drop-off post-acceptance.
- **M5, Trust:** two-way ratings plus reputation aggregation on profiles.
- **M6, Evaluation:** the Next.js metrics dashboard over `GET /admin/metrics` (data already accumulating since M1), polish, and the Kigali user test.
- **M7, Routing + pricing v2 + in-app navigation (scope revision — see [section 1](#routing--in-app-navigation-m7--in-scope)):** a `routing` OSRM proxy module mirroring `geocode` (`GET /routing/route`, great-circle fallback); **pricing v2** (`min_fare` + `rate_per_min` migration, road distance *and* duration priced, the used distance/duration/source persisted on the JOB); owner-side route context (the real road polyline plus road distance and duration on create-job and job detail, replacing the straight line when a route is available); and the driver's **NavigationScreen** — full-screen `flutter_map` turn-by-turn with follow-me camera, an instruction banner with a live countdown, remaining distance/ETA, guarded off-route rerouting, `flutter_tts` voice guidance, and `wakelock_plus`, with "Open in Maps" kept as the secondary option and the OSRM-unreachable fallback.

**Stretch (after M4–M5 are green; optional demo polish):**
- **S1, Minimal basemap:** `flutter_map` points at a muted OSM-based tile source (CartoDB Positron or a light style) with clean custom markers (a blue "you" dot, green vehicle pins). It is small and high-impact; raster-only, with no vector tiles, no SDK, and no key beyond a basemap provider's free tier (respecting its terms and attribution). It is safe to do independently at any point.
- **S2, Live driver position:** while a job is active (post-acceptance through completion), the driver's app emits its location on an interval to the M4 WebSocket gateway, which broadcasts to the owner subscribed to that job; the owner's marker animates. It is bound to the active job (starting on acceptance, stopping on completion) to protect battery and privacy, and a driver's live position is never exposed before a match. It shows the dot plus a straight-line distance, with no ETA or routing.

## 7. Metrics to instrument (for the results chapter)
- Verification task completion and accuracy; profile completeness.
- Availability of at least one matching driver within the radius; time-to-match.
- Share of jobs posted at the estimated cost unchanged (estimate-acceptance rate); the effect of the estimate on time-to-acceptance.
- The proportion of post-match coordination conducted in-app.
- Pre/post change in trust perception; self-reported empty-trip frequency.

These are computed server-side and exposed via `GET /admin/metrics`, then rendered in the admin dashboard; the same numbers feed the results chapter.

## 8. Non-functional notes
- **Auth:** NestJS-issued JWT. Postgres `USER` holds `password_hash` (bcrypt/argon2), with no Firebase Auth. Short-lived access tokens plus refresh; single-use, expiring password-reset and email-verification tokens; `JwtAuthGuard` plus `RolesGuard` protect every route by role.
- **Admin:** one `admin` account is seeded via migration/config, with no public admin signup. The Next.js admin authenticates against the same NestJS API; all `/admin/*` routes are admin-only.
- **Gating:** a driver appears in matching only if verification is approved AND availability is online.
- **Privacy:** a user's phone number is revealed to the counterparty only after a proposal is accepted, never browsable beforehand.
- **Storage:** verification documents go to Firebase Storage via the API (no public bucket); Postgres stores only the `storage_reference`. Documents are sensitive (licences, national IDs).
- **Money:** RWF is zero-decimal, stored as integer whole francs, never as a float and never multiplied by 100.
- Push notifications (FCM) fire for new proposals, accept/decline, and new messages.
- **Live location (stretch S2):** a driver's continuous position is shared only while a job of theirs is active (accepted through completed) and is visible only to that job's owner, never before a match and never after completion. It is emitted on a sensible interval and stopped promptly, to bound battery drain and respect driver privacy.

## 9. Project structure & conventions (DRY, feature-based)
`flutter create`, `nest new`, and `create-next-app` scaffold the baseline (`lib/`, `src/`, `app/`, configs, entrypoints) but do not impose an internal architecture. The feature-based, DRY layout below is the convention scaffolded into. Top level (monorepo):

```
loop/
├── mobile/   Flutter
├── admin/    Next.js
├── api/      NestJS
└── docs/
```

### mobile/: Flutter, feature-first
```
mobile/lib/
├── main.dart
├── app.dart                  # MaterialApp, router + theme wiring
├── core/                     # shared across features (DRY)
│   ├── api/                  # ONE Dio client + interceptors (auth, errors)
│   ├── config/               # env, constants
│   ├── theme/                # colours, typography: single source of truth
│   ├── routing/
│   ├── errors/
│   ├── widgets/              # shared reusable widgets
│   └── utils/                # formatters, validators
├── features/                 # one folder per feature
│   ├── auth/  onboarding/  matching/  jobs/  proposals/  messaging/  ratings/  profile/
│   ├── navigation/           # M7: driver turn-by-turn (NavigationScreen + route follower)
│   └── <feature>/{data, presentation}     # add domain/ only if a feature truly needs it
└── shared/models/            # API models (prefer generating from OpenAPI, see below)
```
State management is `provider` (the existing app's choice), used consistently across every feature; there is no migration to Riverpod/Bloc.

### api/: NestJS, module per feature
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
    ├── auth/  users/  verification/  vehicles/  matching/  pricing/  geocode/  routing/
    ├── jobs/  proposals/  messaging/  ratings/  admin/
    └── <feature>/{<feature>.module.ts, .controller.ts, .service.ts, entities/, dto/}
```
ORM: TypeORM has native PostGIS `geometry`/`geography` columns (simplest for the matching query); Prisma also works, with raw SQL for the geo parts. Metrics aggregation lives in the `admin` module (`admin.service` behind `GET /admin/metrics`). A shared `mail` service wraps SendGrid (with a console-log stub for dev) and is reused by `auth`; a `notifications` helper wraps FCM; the `messaging` module hosts the WebSocket gateway for real-time chat.

### admin/: Next.js, feature-based (App Router as a thin routing shell)
```
admin/src/
├── app/                      # routing ONLY: pages import from features/
│   ├── login/page.tsx
│   └── (dashboard)/{verifications, metrics, users, jobs}/page.tsx
├── features/                 # the real code, one folder per feature (DRY)
│   ├── auth/  verifications/  metrics/  users/  jobs/
│   └── <feature>/{components, hooks, api, types.ts}
├── components/ui/            # shared design-system primitives (e.g. shadcn/ui)
├── lib/                      # ONE API client to NestJS, auth, query client, utils
└── types/                    # shared types (generate from the API, see below)
```
Data layer: TanStack Query via per-feature hooks (`useVerifications`, `useMetrics`) over the single API client, with a chart lib (e.g. Recharts) for the dashboard. `react-admin` is opinionated and fights a custom `features/` layout; Refine tolerates it where CRUD scaffolding is wanted.

### DRY backbone across all three apps
The biggest duplication risk is the API contract, so NestJS is the single source of truth:
- OpenAPI is enabled in NestJS (`@nestjs/swagger`).
- Clients are generated: Next.js types via `openapi-typescript` (or `orval`), Flutter models via `openapi-generator` (`dart-dio`).
- A DTO changes once in the API and both clients regenerate, with no hand-copied models in three places.

---

## Appendix: Stretch features (S1, S2)

Detailed specifications for the two stretch items in [section 6](#6-suggested-build-order-maps-to-the-junaug-timeline), to be built only after M4–M5 are green (S1 is safe any time once M2's map exists; S2 needs the M4 WebSocket gateway). The scope and rationale are in [section 1](#1-mvp-feature-set-what-done-means) (Stretch) and [section 6](#6-suggested-build-order-maps-to-the-junaug-timeline) (S1/S2).

### S1: Minimal / abstracted basemap

An abstracted, Uber-like map look with no new infrastructure. It is small and raster-only.

- `flutter_map`'s `TileLayer` points at a muted OSM-based basemap instead of standard OSM tiles: a CartoDB "Positron"/light style (for example the `light_all` raster endpoint) or a Stadia/MapTiler light style. The tile URL and attribution string live in `core/config` so they are swappable rather than hardcoded in widgets. There are no vector tiles, no map SDK, and no Google.
- The required attribution ("© OpenStreetMap contributors, © CARTO", or the chosen provider's) is shown on the map, per its terms.
- The default markers are replaced with clean custom ones used consistently on both maps (the owner Nearby map and the create-job pins): a blue "you" dot, green vehicle pins, and distinct pickup/drop-off pins, keeping the existing straight green line between pins.
- If the basemap provider needs a key or account for its tiles, it is read from `--dart-define`/env and never committed; a fully keyless option (CartoDB basemaps are free for reasonable use with attribution) is preferred.

### S2: Live driver position (owner map)

The cargo owner sees the assigned driver's live position move toward pickup after acceptance, reusing the M4 WebSocket gateway with no new real-time infrastructure. The privacy and battery scoping is exact.

Scope (hard rules):
- Live location is shared only while a job of the driver's is active: it starts when a proposal on that job is accepted and stops on completion (or cancellation), never before a match and never after completion.
- It is visible only to that job's owner. A driver's live position is never exposed to browsing owners.
- The driver's marker is shown with a straight-line distance to pickup (PostGIS/great-circle), for example "driver ~800 m away". There is no road ETA and no routing.

Backend (NestJS, on the existing gateway):
- A job-scoped location channel/room runs on the M4 WebSocket gateway. The driver's app emits `{ jobId, lat, lng }` on an interval while the job is active; the gateway authorises (the sender is the accepted driver on that job) and broadcasts to the room the job's owner has joined.
- The latest position is persisted on the driver (reusing the existing `users.location` `geography(Point,4326)` column), with no event/history table.
- The room is guarded: only the job's owner may subscribe to that job's location, and only the assigned driver may publish; other requests are rejected.

Mobile (Flutter, provider, reusing the gateway client):
- Driver side: while a job is active, location is emitted on an interval (for example every 5 to 10 seconds) using `geolocator`; the stream stops on completion/cancellation and on leaving the screen or going offline, to bound battery use.
- Owner side: on the active-job detail, the app subscribes to the job's location channel and animates the driver's marker as updates arrive, showing the straight-line distance to pickup. It degrades gracefully when no update arrives (showing the last-known position with a subtle "updating…") and unsubscribes on completion or on leaving the screen.
- The S1 custom markers are used if S1 is already in.

Verification: only the assigned driver can publish and only the owner can subscribe (authorisation enforced); the stream starts on acceptance and stops on completion; the distance is straight-line; and there are no routing calls.
