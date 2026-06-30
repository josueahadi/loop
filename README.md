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

M1 (Foundation) is built: monorepo, database schema for all core entities, JWT auth,
driver verification + admin review. Milestone plan (M1–M6) is in `docs/BUILD_SPEC.md` §6.
