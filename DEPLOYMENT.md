# Loop: Deployment Guide

This guide deploys Loop as a single **Railway** project with **three services** — a PostGIS database, the NestJS **API**, and the Next.js **admin** — plus the external **Firebase Storage/FCM** and **SendGrid** dependencies. The Flutter mobile app is built into an APK that points at the API's public URL.

Every step lists the tool, the exact command or Railway action, and the environment it applies to, so the deploy is **reproducible**. Section 9 is a **runnable verification checklist** to fill in against the hosted stack.

> Secrets rule: every secret lives in Railway **service variables**. The repo only ever commits `*.example` templates with placeholder values.

## Contents

1. [Architecture overview](#1-architecture-overview)
2. [Environments (local dev vs production)](#2-environments-local-dev-vs-production)
3. [Prerequisites](#3-prerequisites)
4. [Deploy steps](#4-deploy-steps)
5. [Going live (flip stubs → real)](#5-going-live-flip-stubs--real)
6. [Mobile (APK)](#6-mobile-apk)
7. [Push notifications (FCM)](#7-push-notifications-fcm)
8. [Secrets](#8-secrets)
9. [Verification in the target environment](#9-verification-in-the-target-environment)
10. [Redeploy / rollback](#10-redeploy--rollback)
11. [Future / production migration](#11-future--production-migration)

---

## 1. Architecture overview

```
                         ┌──────────────────────── Railway project ──────────────────────--──┐
                         │                                                                   │
  Flutter APK  ─────────-┼────────────►  api  (NestJS, Dockerfile)  ──────►  db (postgis)    │
  (API_BASE_URL =        │  HTTPS         │  *.up.railway.app          SQL   postgis/postgis │
   api public URL)       │                │  REST + Socket.IO               :17-3.5          │
                         │                │                                                  │
  Admin browser ──────-──┼────────────►  admin (Next.js standalone, Dockerfile)              │
                         │  HTTPS         │  *.up.railway.app  ── NEXT_PUBLIC_API_BASE_URL   |
                         │                │        (calls the api service over HTTPS).       |
                          ────────────────┼──────────────────────────────────────────────────
                                          │
                    external (not in Railway):
                      • Firebase Storage  — private bucket for verification documents
                      • Firebase FCM      — push notifications
                      • SendGrid          — transactional email (reset / verify)
                      • OpenStreetMap      — Photon (search) + Nominatim (reverse geocode)
```

- **db**: `postgis/postgis:17-3.5` (identical to `docker-compose.yml`). System of record. Because it's a **custom image**, Railway shows **no built-in DB UI**; to browse the data you can _optionally_ enable a **TCP Proxy** and connect a GUI ([section 4.1](#41-add-the-postgis-database-service)). The api always reaches it over the **private** network.
- **api**: built from `api/Dockerfile`; owns auth (JWT), matching, jobs, proposals, messaging (REST + WebSocket), ratings, admin. Binds `0.0.0.0:$PORT`.
- **admin**: built from `admin/Dockerfile` (Next.js standalone); verification queue + metrics dashboard; talks to `api` over HTTPS.
- **Firebase / SendGrid / OSM** are external services the api calls out to.

### Why these deployment choices

- **One Railway project, three services**: the pilot deliverable is a single, reproducible environment. Co-locating db + api + admin keeps one dashboard, one set of secrets, and private-network DB access with no extra config. (Production alternatives are in [section 11](#11-future--production-migration).)
- **`postgis/postgis:17-3.5` (custom image), not Railway's Postgres plugin**: Loop's matching/pricing needs the **PostGIS** extension, and using the same image as `docker-compose.yml` means local and prod behave identically.
- **Stubs first (`MAIL/STORAGE/PUSH=stub`), flip to real later**: the app deploys and the full auth/matching/jobs loop runs **without** Firebase or SendGrid credentials, so a broken third-party integration can't block the first deploy. Going live is then an env-only change ([section 5](#5-going-live-flip-stubs--real)).
- **Migrations as a pre-deploy command, never on app boot**: a DB hiccup during a release fails the migration step, not the running server, so the app can't crash-loop on startup. `synchronize` stays off; schema changes go only through migrations.
- **Serverless / App Sleeping OFF**: a sleeping api cold-starts the first request and **drops the messaging WebSocket**; a sleeping db stalls every query. For a live demo, warm services matter more than idle savings.
- **`DB_SSL` env-driven (off here)**: the pilot's private PostGIS has no TLS, but the flag lets a future managed DB (which requires TLS) be a config change, not a code change.

---

## 2. Environments (local dev vs production)

The same code runs in both; behaviour differs **only by environment variables**.

| Concern | LOCAL DEV | PRODUCTION (Railway) |
| --- | --- | --- |
| Orchestration | `docker-compose` (db) + `npm run start:dev` | 3 Railway services (db, api, admin) |
| Database | `postgis/postgis:17-3.5` on `localhost:5433` | `postgis/postgis:17-3.5` Railway service, private URL |
| `DATABASE_URL` | `postgres://loop:loop@localhost:5433/loop` | constructed from the `db` service vars (see [section 4.2](#42-deploy-the-api-service)) |
| `DB_SSL` | `false` (compose has no SSL) | `false` (Railway private PostGIS has no SSL) |
| API host/port | `0.0.0.0:3000` | `0.0.0.0:$PORT` (Railway injects `PORT`) |
| CORS | `CORS_ORIGINS` empty → allow all | `CORS_ORIGINS` = admin origin(s), **no wildcard** |
| Email (`MAIL_DRIVER`) | `stub` — links logged to console | `sendgrid` — real send via verified sender |
| Storage (`STORAGE_DRIVER`) | `stub` — fake references, no upload | `firebase` — private bucket + signed document URLs (M6) |
| Push (`PUSH_DRIVER`) | `stub` — logged | `fcm` — real Firebase Cloud Messaging |
| JWT secrets | dev throwaway values | **fresh** strong secrets (never the dev ones) |
| Migrations | `npm run migration:run` (ts-node) | `npm run predeploy:prod` as the pre-deploy command (migrate + seed) |
| Admin API URL | `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000` | build arg = api public HTTPS domain |
| HTTPS/TLS | none (http) | automatic (`*.up.railway.app`) |

Flipping `stub → sendgrid/firebase/fcm` is the whole "going live" step ([section 5](#5-going-live-flip-stubs--real)). Nothing in the code changes.

---

## 3. Prerequisites

- **Railway account** + the Railway CLI (optional) — <https://railway.app>.
- **GitHub repo** connected to Railway (deploy from `main`), or the Railway CLI.
- **Firebase project** with a **Storage bucket** (private) and a **service-account** key (JSON). Same project provides FCM.
- **SendGrid account** with an **API key** (restricted to _Mail Send_) and a **verified single sender** (or authenticated domain).
- **Docker** locally (to reproduce the image builds before deploying).
- **Flutter SDK** (to build the mobile APK, [section 6](#6-mobile-apk)).
- _(Optional)_ a DB GUI — **DBeaver** or **TablePlus** — only if you want to browse the DB from your laptop; not required to deploy (see [section 4.1](#41-add-the-postgis-database-service)).

---

## 4. Deploy steps

All steps are in the **one** Railway project. Do them in order.

### 4.0 Create the project

1. Railway → **New Project** → **Empty Project**. Name it `loop`.

### 4.1 Add the PostGIS database service

1. **New → Empty Service**, name it exactly **`db`** (this name is referenced by the api's `DATABASE_URL` in [section 4.2](#42-deploy-the-api-service) — keep it consistent). Set its source to the **Docker image** `postgis/postgis:17-3.5` (Settings → Source → Docker Image). _Why the custom image and not Railway's Postgres plugin: Loop needs the PostGIS extension, matching `docker-compose.yml` exactly._
2. Add its variables (Variables tab):
   - `POSTGRES_USER=loop`
   - `POSTGRES_PASSWORD=<strong-password>`
   - `POSTGRES_DB=loop`
   - `PGDATA=/var/lib/postgresql/data/pgdata`: **required with a Railway volume.** The volume mount (`/var/lib/postgresql/data`) contains a `lost+found` directory, and `initdb` refuses a non-empty data dir (`directory … exists but is not empty` → crash loop). Pointing `PGDATA` at a **subdirectory** makes Postgres init into an empty folder beside `lost+found`. (`PGDATA` is only where files live on disk — it does **not** change the `DATABASE_URL`.)
3. Add a **Volume** so data persists across redeploys. Volumes are **not** in the Settings tab — attach one from the canvas: **right-click the `db` service** (or press `⌘K` → "Volume") → **Attach Volume**, and set the **mount path** to `/var/lib/postgresql/data` (Postgres then stores data in the `pgdata` subdirectory per `PGDATA` above). Do this **before** the first real use — a volume attached after data is written may not migrate the existing ephemeral data.
4. **Settings → Deploy → Serverless** → turn it **OFF** for `db` (this is the "App Sleeping" control). The database must stay warm — a sleeping DB stalls the first request.
5. Deploy. Unlike Railway's managed Postgres, this raw image does **not** auto-compose a `DATABASE_URL` — the api constructs one from this service's vars ([section 4.2](#42-deploy-the-api-service)). The db is **unexposed** (private network only) by default — that is correct; the api reaches it privately.

> **Optional — external DB inspection only.** To browse the data from your laptop (DBeaver/TablePlus), turn on **Settings → Networking → TCP Proxy**. This makes the DB a **public** endpoint (guarded only by the Postgres password — use a strong one), so connect with **SSL disabled** (the image has no TLS), and turn the proxy back **off** when done. Railway bills egress on proxy traffic. Not needed to deploy or to run the [section 9](#9-verification-in-the-target-environment) verification.

### 4.2 Deploy the API service

1. **New → GitHub Repo** (or **Empty Service** + connect repo). Name it `api`.
2. Settings → **Root Directory** = `api`, **Builder** = **Dockerfile** (`api/Dockerfile`). Railway auto-detects the Dockerfile at that root.
3. **Variables**: set every key from [`api/.env.production.example`](api/.env.production.example). Notably:
   - `DATABASE_URL` → the postgis image has no auto-composed URL, so **construct it** from the `db` service's variables:
     ```
     postgres://${{db.POSTGRES_USER}}:${{db.POSTGRES_PASSWORD}}@${{db.RAILWAY_PRIVATE_DOMAIN}}:5432/${{db.POSTGRES_DB}}?sslmode=disable
     ```
     The api reaches `db` over Railway's **private network** (port `5432`, no port mapping), and the postgis image has **no TLS**, so `sslmode=disable` — traffic never leaves the internal network. Keep `DB_SSL=false` (its code twin).
   - `PORT` → **leave unset**; Railway injects it.
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` → **generate fresh** values, e.g. `openssl rand -base64 48` (two different values).
   - `APP_URL` → the api's own public domain (set it once the domain is generated below).
   - `CORS_ORIGINS` → set once the admin domain exists ([section 4.3](#43-deploy-the-admin-service), last step).
   - Keep `MAIL_DRIVER=stub` / `STORAGE_DRIVER=stub` / `PUSH_DRIVER=stub` for the first deploy; flip to real in [section 5](#5-going-live-flip-stubs--real).
4. **Settings → Deploy → Healthcheck Path** = `/health` (the api returns `200 {status:'ok'}`).
5. **Settings → Deploy → Serverless** → turn it **OFF** for `api` (the "App Sleeping" control) — **required** so the live demo has no cold-start; a sleeping api also drops the messaging WebSocket connections.
6. Settings → **Networking** → **Generate Domain** to get `https://<api>.up.railway.app`. Put it in `APP_URL`.
7. **Settings → Deploy → Pre-Deploy Command** = `npm run predeploy:prod` — a single script that runs migrations **then** the seed (`migration:run:prod && seed:prod`). Use the combined script, not the raw `A && B` in this field: Railway's pre-deploy does not reliably chain `&&`, so the seed half can silently skip. The first run creates the schema + the PostGIS extension, then seeds the admin + pricing/size config. Both are idempotent (migrations skip applied ones; the seed upserts), so it is safe on **every** deploy. Deploy.
   - _Fallback:_ if the seed ever needs a manual run, open the service **Console** and run `npm run seed:prod` — it upserts the admin from the current env vars.

   > Migrations are **not** run on app boot — only as this pre-deploy command — so a DB hiccup can never crash-loop the server.

### 4.3 Deploy the admin service

1. **New → GitHub Repo** (same repo). Name it `admin`. Settings → **Root Directory** = `admin`, **Builder** = **Dockerfile** (`admin/Dockerfile`).
2. Because `NEXT_PUBLIC_API_BASE_URL` is **inlined at build time**, set it so the build picks it up:
   - Add service **Variable** `NEXT_PUBLIC_API_BASE_URL=https://<api>.up.railway.app` (Railway passes variables to the Docker build), **or**
   - set the Docker **build arg** `NEXT_PUBLIC_API_BASE_URL` to the same value.
3. **Generate Domain** for the admin → `https://<admin>.up.railway.app`.
4. Go back to the **api** service and set `CORS_ORIGINS=https://<admin>.up.railway.app` (comma-separate if there are several origins). Redeploy the api so the new CORS list takes effect for both the HTTP app and the Socket.IO gateway.

Railway serves every generated domain over **HTTPS automatically** — no cert setup.

---

## 5. Going live (flip stubs → real)

Do this once the three services are up and smoke-tested ([section 9](#9-verification-in-the-target-environment)). Change **only env vars** on the **api** service, then redeploy:

1. **SendGrid**: `MAIL_DRIVER=sendgrid`, `SENDGRID_API_KEY=<key>`, `SENDGRID_FROM=<verified sender>`. Verify the sender/domain in SendGrid first, or mail silently fails.
2. **Firebase Storage**: `STORAGE_DRIVER=firebase`, `FIREBASE_SERVICE_ACCOUNT_JSON=<full service-account JSON, inline>`, `FIREBASE_STORAGE_BUCKET=<your-bucket>`. Paste the service-account JSON **exactly as downloaded** — its `private_key` newlines are already `\n`-escaped inside the JSON, and the app `JSON.parse`s the value as-is (no manual re-escaping). This also **activates the M6 admin document signed-URLs** (the admin can then view uploaded documents) and the private-bucket uploads. Keep the bucket **private**.
3. **FCM**: `PUSH_DRIVER=fcm` (uses the same Firebase credentials above). Full push setup — client config + platform status — is in [section 7](#7-push-notifications-fcm).

Redeploy the api. Re-run the [section 9](#9-verification-in-the-target-environment) checks that depend on these (document view, email).

---

## 6. Mobile (APK)

The mobile app is not on Railway; it is built pointing at the api's public URL.

```bash
cd mobile
flutter build apk --release \
  --dart-define=API_BASE_URL=https://<api>.up.railway.app
# output: build/app/outputs/flutter-apk/app-release.apk
```

- The Android `<queries>` block for `map_launcher` (Google/Waze deep links) is present in `mobile/android/app/src/main/AndroidManifest.xml` — confirm it is still there before release.
- **Android build tooling:** requires Android Gradle Plugin **≥ 8.11.1** / Gradle **≥ 8.14.3** (pinned in the repo) because `firebase_messaging` pulls in AndroidX libs needing AGP 8.9.1+.

### 6.1 Publishing the APK as a GitHub Release

The APK is distributed as an asset on a **GitHub Release**, so the README's download link and QR code can point at a stable URL. Build against the production API (above), then:

```bash
# From the repo root, with the gh CLI authenticated.
cp mobile/build/app/outputs/flutter-apk/app-release.apk /tmp/loop-<version>.apk

# First release for a version — creates the tag and uploads the asset:
gh release create v<version> /tmp/loop-<version>.apk \
  --title "Loop v<version>" \
  --notes "Android APK, pre-configured for the hosted API."

# Updating the APK on an existing release (e.g. after a fix) — replaces the asset
# in place, so the download link and QR keep working:
gh release upload v<version> /tmp/loop-<version>.apk --clobber
```

- The README links to `https://github.com/<owner>/<repo>/releases/latest`, which always redirects to the newest release — so the link and the QR (`apk-download-qr.png`) do not change between releases.
- After building, verify the asset actually embeds the production URL (`strings app-release.apk | grep <api-domain>`) so a stale localhost build is never published.
- Alternatively, share the APK file directly or use **Firebase App Distribution** for a tester group.

---

## 7. Push notifications (FCM)

Push runs through **Firebase Cloud Messaging** on the **`loop-rw`** project. The API pushes to a user's device on: proposal sent / accepted / declined, new message, and verification approved / rejected. Firebase is used for push (and server-side Storage) **only** — identity stays NestJS JWT.

**Server side (Railway `api` service):**

```
PUSH_DRIVER=fcm
FIREBASE_SERVICE_ACCOUNT_JSON={...}   # loop-rw service account, inline (already set for Storage)
```

`PushService` looks up the recipient's `fcm_token` (stored via `POST /me/push-token`) and sends via `firebase-admin`. It is **best-effort** — a missing token or send failure never fails the underlying action. With `PUSH_DRIVER=stub` (dev default) pushes are only logged.

**Client side (mobile):**

- Native config (`firebase_options.dart`, `android/app/google-services.json`, `ios/Runner/GoogleService-Info.plist`) is generated by `flutterfire configure --project=loop-rw`. These are **client configs** (public app IDs / API keys — no secrets) and are committed. Re-run `flutterfire configure` if app IDs change.
- On login the app registers its FCM token; `POST /me/push-token` persists it to `users.fcm_token`.

**Platform status:**

- **Android**: fully working on a device *or* an emulator with **Google Play services** (see `mobile/README.md` → Android emulator). No store listing, no paid account.
- **iOS**: needs a **paid Apple Developer account** to create an **APNs key** (uploaded to Firebase → Cloud Messaging), and a **physical iPhone** (the simulator can't receive remote push). No store listing required. Until the APNs key is added, iOS push is inert; the app still runs.

---

## 8. Secrets

- **All** secrets live in **Railway service variables** — never in git.
- Only `*.example` files are tracked (`api/.env.example`, `api/.env.production.example`, `admin/.env.production.example`); they contain **placeholders only**.
- `.gitignore` ignores real `.env`/`.env.*` and any `*-service-account*.json`, and re-includes `*.example`. The Firebase service-account JSON is provided **inline** via `FIREBASE_SERVICE_ACCOUNT_JSON` (a Railway variable) — no key file in the repo or image.
- Production JWT secrets are **freshly generated**, never the dev values.

---

## 9. Verification in the target environment

Run these against the **hosted** stack. Results below are from the live deployment on **2026-07-05**:

```bash
API=https://loop-api-prod.up.railway.app
ADMIN=https://loop-admin-prod.up.railway.app
```

| # | Check | Command / action | Expected | Result |
| --- | --- | --- | --- | --- |
| 1 | Health | `curl -s $API/health` | `{"status":"ok"}` (200) | ✅ `{"status":"ok"}` (200) |
| 2 | Docs load | open `$API/docs` | Swagger UI renders | ✅ 200, Swagger renders |
| 3 | Register | `curl -s -XPOST $API/auth/register … role: cargo_owner` | 201 + `accessToken` | ✅ 201, token returned |
| 4 | Login → `/me` | login, then `curl $API/me -H "Authorization: Bearer <token>"` | 200, `role: cargo_owner` | ✅ 200, role correct |
| 5 | Metrics guarded (unauth) | `curl -s -o /dev/null -w "%{http_code}" $API/admin/metrics` | `401` | ✅ 401 |
| 6 | Metrics (admin) | login as seeded admin → `curl $API/admin/metrics -H "Authorization: Bearer <admin>"` | 200, all metric groups | ✅ 200, all groups (e.g. users_by_role `{admin:1, cargo_owner:1}`) |
| 7 | Geocode (auth) | `curl -s "$API/geocode/search?q=Kigali%20Convention%20Centre" -H "Authorization: Bearer <token>"` | resolves a Kigali result | ✅ resolves "Kigali Convention Centre" (-1.9547, 30.0947) |
| 8 | Post a job | `POST $API/jobs` (as owner, with pins) | 201, job created | ☐ pending manual (mobile owner flow) |
| 9 | Proposal → accept | owner sends proposal, driver accepts | job → `matched`, contact appears on acceptance | ☐ pending manual |
| 10 | Message over socket | connect Socket.IO w/ JWT, send in the job room | message delivered to the other participant | ☐ pending manual |
| 11 | Doc upload + signed view URL | driver `POST /verification` (file) → admin `GET /admin/verifications/:id/document-url` | real signed URL (not stub); URL serves the file | ✅ `stub:false`, signed `storage.googleapis.com/loop-rw…` URL, fetch → 200 (Firebase Storage live) |
| 12 | CORS enforced | request `$API` from a disallowed origin | blocked; allowed origins work | ✅ admin + `localhost:3001` allowed; other origins blocked (no wildcard) |

> Checks 1–7, 11, 12 were run against the hosted API and passed. Checks 8–10 are the interactive product loop — drive them from the admin web app and the mobile APK ([section 6](#6-mobile-apk)). Note geocode (7) is **auth-gated**, so it needs a bearer token.

> The mobile end-to-end (register → verify → go online → owner matches → propose → accept → chat → complete → rate) is the same flow, driven from the APK built in [section 6](#6-mobile-apk).

---

## 10. Redeploy / rollback

- **Redeploy:** push to `main` (Railway auto-deploys the connected services), or hit **Deploy** in the Railway UI. The api's pre-deploy runs `migration:run:prod` — new migrations apply automatically; already-applied ones are skipped.
- **Rollback:** Railway → service → **Deployments** → pick a previous successful deployment → **Redeploy**. Note: a rollback redeploys the old **code/image**, it does **not** revert the database. If a migration must be undone, run `npm run migration:revert` (dev) / the equivalent against prod deliberately — data migrations are not auto-reverted.
- **DB safety:** the db service's volume persists across redeploys; deleting the service or its volume is the only way to lose data.

## 11. Future / production migration

The pilot runs entirely on **Railway** (section 1) — one project, three services — chosen for speed and low operational surface while proving the product. That is the right choice for a pilot, **not** the right shape for a long-running product: Railway's Postgres here is a self-managed container (you own backups — see below), and co-locating everything trades tool-fit for convenience.

The architecture was built to make the eventual move cheap. Every service is **Dockerised**, the API connects through a **standard `DATABASE_URL`**, and TLS is governed by the env-driven **`DB_SSL`** flag — so each step below is a **configuration change, not a rewrite**. Do them independently, one at a time.

### Planned moves (priority order)

1. **Database → Supabase (managed Postgres + PostGIS).** The most important move — the one piece that is hard to lose and hard to swap under load. Gains: automated backups + point-in-time recovery, an always-on managed instance, and the Supabase Studio dashboard.
   - _What changes:_ create a Supabase project; enable PostGIS (`create extension postgis;`); point the API's `DATABASE_URL` at Supabase's connection string; **set `DB_SSL=true`** (Supabase requires TLS — the opposite of the `sslmode=disable` / `DB_SSL=false` used for the pilot's no-TLS image). Use the **direct** connection for migrations and the **pooled** connection for the app. Move data with `pg_dump` (Railway DB) → restore into Supabase.
2. **Admin → Vercel.** Next.js-native hosting with per-branch preview deployments.
   - _What changes:_ import the repo in Vercel with **root directory `admin`**; set `NEXT_PUBLIC_API_BASE_URL` (still inlined at build — a domain change means a rebuild); deploy; add the resulting Vercel domain to the API's `CORS_ORIGINS`; remove the admin service from Railway.
3. **API → Fly.io (Johannesburg region).** Optional, for latency — `jnb` is far closer to Rwandan users than EU-region hosting, and Fly is Docker-native so `api/Dockerfile` deploys as-is.
   - _What changes:_ deploy the same image to Fly in `jnb`; move env vars to Fly secrets; keep `DATABASE_URL` → Supabase and `DB_SSL=true`; update the mobile `API_BASE_URL` and admin `NEXT_PUBLIC_API_BASE_URL` to the new API domain (both need a rebuild).

At the fully-managed end (only if the user base demands it), the ceiling is AWS (RDS/Aurora PostGIS + Fargate/App Runner, Cape Town region) or GCP (Cloud SQL + Cloud Run) — more capability, more ops and cost than a growing pilot needs. Don't reach for it early.

### Backups (once there is real pilot data)

The pilot DB is a self-managed container, so nothing backs it up automatically. You don't need scheduled infrastructure for a pilot — just run a single **`pg_dump`** at the end of the pilot (or each pilot day) to a file on your machine. That protects the one irreplaceable thing: the results data your report depends on. Once on Supabase (move 1), backups + PITR are handled for you.

> **Scope note:** this section is _operational_ future work only. Product/feature future work — payments, live driver tracking (Stretch S2), the abstracted basemap (Stretch S1), address search at scale, road routing — is tracked in `docs/BUILD_SPEC.md` (Out-of-scope + Stretch) and the report's Future Work chapter.
