# Loop

Real-time geo-matching platform connecting cargo owners with vehicle drivers in Rwanda. Monorepo:

```
loop/
├── mobile/   Flutter app (cargo owner + driver)   → see mobile/README.md
├── api/      NestJS REST API + PostgreSQL/PostGIS  → see api/README.md
├── admin/    Next.js admin (verification + metrics) → see admin/README.md
└── docs/     spec, diagrams, proposal
```

The **API is the system of record** (PostgreSQL/PostGIS). The mobile app and admin are clients of it.

## Quick start (local development)

**Prerequisites:** Docker, Node.js 20+, and the Flutter SDK.

```bash
# 1. Database — PostgreSQL 17 + PostGIS 3.5 (host port 5433)
docker compose up -d

# 2. API — NestJS on http://localhost:3000 (Swagger at /docs)
cd api
cp .env.example .env            # dev defaults: stub mail/storage/push
npm install
npm run migration:run           # creates the schema + PostGIS extension
npm run seed                     # seeds the admin account + pricing/size config
npm run start:dev

# 3. Admin — Next.js on http://localhost:3001
cd ../admin
cp .env.example .env.local       # NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
npm install
PORT=3001 npm run dev            # http://localhost:3001  (login: admin@loop.rw)

# 4. Mobile — Flutter (iOS simulator / Android emulator / device)
cd ../mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://localhost:3000
#   Android emulator: use http://10.0.2.2:3000 instead of localhost
```

The seeded admin credentials come from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `api/.env` (defaults: `admin@loop.rw` / `change-me-admin`). Backend details and the full endpoint list are in [`api/README.md`](api/README.md); the admin app is documented in [`admin/README.md`](admin/README.md).

## Deployment

Loop deploys to **Railway** as one project with three services (PostGIS DB, API, admin) plus external Firebase Storage/FCM and SendGrid. Full, reproducible steps — architecture, environment matrix, prerequisites, deploy commands, going-live, the mobile APK build, secrets handling, and a hosted-stack verification checklist — are in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Walkthrough video

📹 **Walkthrough video:** _TODO — the recorded demo link will be added here_ (`https://…`). It walks through onboarding a driver, admin verification, posting a job, matching, messaging, and the metrics dashboard.

## Status

All milestones **M1–M6** are built (milestone plan in `docs/BUILD_SPEC.md` §6):

- **M1 — Foundation:** monorepo, database schema for all core entities, NestJS-issued JWT auth (argon2, access + rotating refresh), driver verification + admin review.
- **M2 — Matching:** availability + location capture, PostGIS nearby-driver query (approved **and** online, nearest first), `flutter_map`/OpenStreetMap map view + vehicle-type filter, vehicle CRUD.
- **M3 — Pricing + jobs:** rule-based **cost-estimate** endpoint + editable config, pin-based job creation and posting (both the estimated cost and the owner-set price are persisted).
- **M3.5 — Location:** OpenStreetMap place/landmark search + reverse-geocoding + "Open in Maps" navigation hand-off.
- **M4 — Transaction loop:** proposals (accept/decline), in-app messaging (REST + WebSocket), `tel:` call button, FCM push (stub-safe).
- **M5 — Trust:** two-way ratings + portable reputation.
- **M6 — Admin:** Next.js verification queue + server-computed metrics dashboard + read-only drivers/users/jobs directory.

## Roadmap (Future Works)

Loop currently runs as a single **Railway** project (PostGIS DB + API + admin), chosen for pilot simplicity. The architecture is deliberately portable — Dockerised services, a standard `DATABASE_URL`, and an env-driven `DB_SSL` flag — so the planned production moves below are each a **configuration change, not a rewrite**:

- **Database → managed Postgres + PostGIS (Supabase):** automated backups + point-in-time recovery and a management dashboard, versus the pilot's self-managed container.
- **Admin → Vercel:** Next.js-native hosting with per-branch preview deployments.
- **API → Fly.io (Johannesburg region):** lower latency to users in Rwanda than EU-region hosting.

See **[DEPLOYMENT.md §10 (Future / production migration)](DEPLOYMENT.md#10-future--production-migration)** for the detail. Product/feature future work (payments, live driver tracking, an abstracted basemap, road routing) is separate — it's tracked in `docs/BUILD_SPEC.md` and the report's Future Work chapter.
