# Loop API

REST API and **system of record** for Loop — a real-time geo-matching platform connecting cargo owners with vehicle drivers in Rwanda.

NestJS + TypeORM over PostgreSQL/PostGIS. This service owns identity, verification, matching, pricing, jobs, proposals, messaging and reputation. The Flutter app (`../mobile`) and the Next.js admin (`../admin`) are clients of this API.

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Node.js 20+ (developed on 24) |
| Framework | NestJS 10 (TypeScript) |
| ORM | TypeORM 0.3 (migrations only — `synchronize: false`) |
| Database | PostgreSQL 17.5 + PostGIS 3.5 (`postgis/postgis:17-3.5`) |
| Auth | JWT (access + rotating refresh), argon2 password hashing |
| Mail | SendGrid (`@sendgrid/mail`) with a console-log dev stub |
| Object storage | Firebase Storage (private bucket) via `firebase-admin`, with a dev stub |
| Geocoding (M3.5) | OpenStreetMap via Photon (search) + Nominatim (reverse), API-proxied |
| API docs | OpenAPI / Swagger at `/docs` (source of truth for generated clients) |

## Deployed (production)

The API is hosted on Railway:

- **Base URL:** `https://loop-api-prod.up.railway.app`
- **Hosted Swagger:** `https://loop-api-prod.up.railway.app/docs`
- Quick check: `curl https://loop-api-prod.up.railway.app/admin/metrics` (401 without a token confirms it's up and auth-guarded).

Point the mobile app at it with `--dart-define=API_BASE_URL=https://loop-api-prod.up.railway.app` (see `../mobile/README.md`), and the admin with `NEXT_PUBLIC_API_BASE_URL=https://loop-api-prod.up.railway.app`. Full deploy details are in `../DEPLOYMENT.md`.

## Prerequisites

- Node.js 20+ and npm
- Docker (for the PostgreSQL/PostGIS container)

## Setup

```bash
# 1. From the repo root — start PostgreSQL + PostGIS (host port 5433)
cd ..            # repo root (where docker-compose.yml lives)
docker compose up -d

# 2. Configure the API
cd api
cp .env.example .env        # then edit secrets as needed (see below)
npm install

# 3. Create the schema and seed the admin + pricing config
npm run migration:run
npm run seed

# 4. Run
npm run start:dev           # watch mode  →  http://localhost:3000
# Swagger UI: http://localhost:3000/docs
```

> The container maps host **5433** → container 5432 (host 5432 is often taken by a local Postgres). `DATABASE_URL` in `.env` already points at 5433.

## Environment

All variables are validated on boot (`src/config/validation.ts`). See `.env.example` for the full list. Key ones:

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection (defaults to the Docker DB on 5433) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets (≥16 chars) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Token lifetimes (e.g. `15m`, `30d`) |
| `ACTION_TOKEN_TTL_HOURS` | Reset/verify token lifetime |
| `MAIL_DRIVER` | `stub` (logs links to console) or `sendgrid` |
| `SENDGRID_API_KEY` / `SENDGRID_FROM` | Required when `MAIL_DRIVER=sendgrid` |
| `STORAGE_DRIVER` | `stub` (no upload) or `firebase` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` / `FIREBASE_STORAGE_BUCKET` | Private bucket for verification docs |
| `NEARBY_RADIUS_KM` | Default matching radius (overridable per request) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` / `ADMIN_PHONE` | Seeded admin account |

> Secrets never go in git. `.env` is git-ignored; commit only `.env.example`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Run with hot reload |
| `npm run build` / `npm run start:prod` | Compile and run from `dist/` |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Roll back the last migration |
| `npm run seed` | Seed admin + pricing/size config (idempotent) |

## Endpoints

The full, always-current schema is at **`/docs`** (OpenAPI/Swagger). The summary below covers every wired route across M1–M6.

**Auth** (public unless noted)

- `POST /auth/register`: cargo_owner | driver only (no admin self-signup)
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `POST /auth/password-reset/request` · `POST /auth/password-reset/confirm`
- `POST /auth/email/verify/request` (authed) · `POST /auth/email/verify/confirm`

**Users** (authed)

- `GET /me` · `PATCH /me`
- `PATCH /me/availability`: `{ status, lat, lng }` (driver online/offline + location, `geography(Point,4326)`)
- `POST /me/photo`: profile photo (multipart → private Storage)
- `POST /me/push-token`: register/clear this device's FCM token

**Verification** (driver)

- `POST /verification`: multipart upload (`documentType` = `licence|national_id|vehicle_reg` + `file`)
- `GET /verification`: own records
- `GET /verification/:id/document-url`: short-lived signed URL for one's own document

**Vehicles** (driver)

- `GET /vehicles` · `POST /vehicles` · `PATCH /vehicles/:id` · `DELETE /vehicles/:id`

**Matching** (cargo owner)

- `GET /drivers/nearby?lat=&lng=&vehicle_type=&radius=`: approved **and** online drivers within radius, nearest first (PostGIS `ST_DWithin`/`ST_Distance`)

**Pricing**

- `POST /pricing/estimate`: `{ pickup, drop_off, vehicle_type, size, weight }` → `{ estimated_price, distance_km }` (rule-based; config-driven; integer RWF)

**Jobs** (cargo owner)

- `POST /jobs` · `GET /jobs` (own) · `GET /jobs/:id` · `PATCH /jobs/:id` (status transitions)
- Persists both `estimated_price` and the owner-set `price`; status-transition timestamps stamped on `PATCH`.

**Proposals**

- `POST /jobs/:jobId/proposals`: owner sends a proposal at the posted price
- `GET /jobs/:jobId/proposals`: proposals on a job · `GET /proposals` (driver: incoming)
- `PATCH /proposals/:id`: accept/decline (accepting auto-declines the job's other pending proposals)

**Messaging** (opens on proposal acceptance)

- `GET /jobs/:jobId/messages` · `POST /jobs/:jobId/messages`
- `GET /messages/unread`: unread counts by job
- Real-time delivery over a NestJS WebSocket gateway (Socket.IO), with Postgres as the source of truth

**Ratings**

- `POST /jobs/:jobId/ratings`: two-way rating after completion
- `GET /users/:id/ratings`: a user's received ratings + aggregate

**Notifications**

- `GET /notifications` · `GET /notifications/unread-count`
- `PATCH /notifications/read-all` · `PATCH /notifications/:id/read`

**Geocoding** (OpenStreetMap proxy)

- `GET /geocode/search?q=&limit=` → `[{ label, lat, lng }]` (Photon, Kigali-biased)
- `GET /geocode/reverse?lat=&lng=` → `{ label }` (Nominatim)

**Admin** (`admin` role only — all `/admin/*` is role-guarded)

- `GET /admin/metrics`: server-computed evaluation metrics (dashboard renders these)
- `GET /admin/verifications` · `PATCH /admin/verifications/:id`: `{ "status": "approved" | "rejected", "note"? }`
- `GET /admin/verifications/:id/document-url`: signed URL to view a submitted document
- `GET /admin/drivers` · `GET /admin/users` · `GET /admin/users/:id`
- `GET /admin/jobs` · `GET /admin/jobs/:id` · `GET /admin/audit`

**Health**

- `GET /health` → `{ "status": "ok" }`

### Quick smoke test

```bash
# register a driver, capture the access token
curl -s -X POST localhost:3000/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Test Driver","email":"d1@loop.rw","phone":"+250780111222","password":"driverpass1","role":"driver"}'
# with MAIL_DRIVER=stub the email-verify link is printed to the API console
```

## Project structure

```
api/src/
├── main.ts                 # bootstrap, global ValidationPipe, Swagger
├── app.module.ts           # wiring + global JwtAuthGuard / RolesGuard / filter
├── common/                 # enums, guards, decorators (@Roles/@CurrentUser/@Public), filters
├── config/                 # env config + Joi validation
├── database/               # data-source, migrations/, seeds/
└── modules/
    ├── auth/   users/  verification/  admin/
    ├── mail/   storage/  push/               # SendGrid + Firebase Storage + FCM, each with a dev stub
    ├── vehicles/ matching/ pricing/ jobs/    # availability, PostGIS matching, pricing, jobs
    ├── geocode/                              # OSM search/reverse proxy
    ├── proposals/ messaging/ ratings/        # transaction loop + reputation
    └── notifications/ health/                # in-app notification centre + healthcheck
```

## Conventions

- **Money:** RWF is zero-decimal → stored as **integer** whole francs. Never minor units.
- **Auth:** every route requires a valid access token unless marked `@Public()`; `@Roles(UserRole.ADMIN)` restricts `/admin/*`.
- **Email verification is non-blocking for login** in the MVP (it sets `email_verified_at` but is not a login gate).
- **Driver gating:** a driver appears in matching only when verification is approved **AND** availability is online.
- **PostGIS** handles all distance/proximity — no geospatial math in app code.
- **Pricing** is a rule-based _estimate_ the owner can override; the JOB stores both `estimated_price` and the posted `price` so estimate-acceptance can be measured.
- **Geocoding** is OpenStreetMap-only (Photon/Nominatim) and API-proxied; there is no routing endpoint — turn-by-turn is handed off to the driver's maps app client-side.

## Milestone status

All milestones **M1–M6** are built: JWT auth, driver verification + admin review (M1); availability, PostGIS nearby-driver query, vehicle CRUD (M2); rule-based cost estimate + jobs create/post (M3); the `/geocode/*` OSM proxy (M3.5); proposals, messaging + push (M4); ratings (M5); and the Next.js admin dashboard (M6). See [section 6 of `../docs/BUILD_SPEC.md`](../docs/BUILD_SPEC.md#6-suggested-build-order-maps-to-the-junaug-timeline) for the plan.
