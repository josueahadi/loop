# Loop

Real-time geo-matching platform connecting cargo owners with vehicle drivers in
Rwanda. Monorepo:

```
loop/
├── mobile/   Flutter app (cargo owner + driver)   → see mobile/README.md
├── api/      NestJS REST API + PostgreSQL/PostGIS  → see api/README.md
├── admin/    Next.js admin (verification + metrics) — added in M6
└── docs/     spec, diagrams, proposal
```

The **API is the system of record** (PostgreSQL/PostGIS). The mobile app and admin
are clients of it.

## Quick start

```bash
docker compose up -d                 # PostgreSQL 17 + PostGIS 3.5 (host port 5433)
cd api && cp .env.example .env && npm install
npm run migration:run && npm run seed
npm run start:dev                    # http://localhost:3000  (Swagger at /docs)
```

Then run the app — see [`mobile/README.md`](mobile/README.md). Backend details and the
full endpoint list are in [`api/README.md`](api/README.md).

## Status

Built through **M3** (milestone plan in `docs/BUILD_SPEC.md` §6):

- **M1 — Foundation:** monorepo, database schema for all core entities, NestJS-issued
  JWT auth (argon2, access + rotating refresh), driver verification + admin review.
- **M2 — Matching:** availability + location capture, PostGIS nearby-driver query
  (approved **and** online, nearest first), `flutter_map`/OpenStreetMap map view +
  vehicle-type filter, vehicle CRUD.
- **M3 — Pricing + jobs:** rule-based **cost-estimate** endpoint + editable config,
  pin-based job creation and posting (both the estimated cost and the owner-set price
  are persisted).

**Next:** **M3.5** — OpenStreetMap place/landmark search + reverse-geocoding + an
"Open in Maps" navigation hand-off — then **M4** (proposals + messaging + `tel:` call
button + FCM push), **M5** (two-way ratings), **M6** (Next.js admin + metrics dashboard).