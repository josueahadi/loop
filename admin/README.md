# Loop Admin (Next.js)

Internal admin web app for Loop — the **verification queue** and the **metrics dashboard**. It talks to the same NestJS API as the mobile app; there is **no public admin signup** and the app performs **no metric math of its own** — every figure is computed server-side by `GET /admin/metrics` and rendered verbatim.

## Stack

- Next.js (App Router, TypeScript) + Tailwind CSS v4
- shadcn/ui (Radix primitives, tokenised light/dark theme) + `next-themes`
- TanStack Query (data fetching/caching)
- Recharts via shadcn `chart` (theme-aware `--chart-*` tokens)
- axios (one API client in `src/lib/api.ts`, JWT attach + refresh-on-401)

All colours come from shadcn design tokens (`background`/`foreground`/`card`/ `muted-foreground`/…) that invert together in dark mode — no hardcoded black/white, so both themes stay readable. Toggle via the sun/moon in the nav; defaults to the OS preference.

## Deployed (production)

Hosted on Railway alongside the API:

- **Admin URL:** `https://loop-admin-prod.up.railway.app`
- **API it talks to:** `https://loop-api-prod.up.railway.app`

`NEXT_PUBLIC_API_BASE_URL` is inlined **at build time**, so the hosted admin is baked against the prod API. To run a local admin against the hosted API instead of a local one:

```bash
echo 'NEXT_PUBLIC_API_BASE_URL=https://loop-api-prod.up.railway.app' > .env.local
npm run dev
```

Full deploy details are in `../DEPLOYMENT.md`.

## Structure (feature-based, per BUILD_SPEC §9)

```
src/
├── app/                  thin routing shell
│   ├── login/            public login page
│   └── (dashboard)/      admin-gated: metrics, verifications (+ nav)
├── features/
│   ├── auth/             login, session, admin gate/nav   {api,hooks,components}
│   ├── verifications/    pending queue + document viewer  {api,hooks,components,types}
│   └── metrics/          KPI cards + charts               {api,hooks,components,types}
├── components/ui/        shared primitives (Card, Button, Badge, …)
└── lib/                  api client, token storage, query provider
```

## Auth model

- Login (`POST /auth/login`) against the same API → `{ accessToken, refreshToken }` stored in `localStorage`; the client re-fetches `GET /me` and rejects any account whose `role` is not `admin`.
- The API's `RolesGuard` is the real authorization boundary. The client-side `AdminGate` only prevents the shell from flashing and redirects unauthenticated / non-admin visitors to `/login`.
- On a `401`, the API client refreshes once (`POST /auth/refresh`) and retries; if refresh fails, tokens are cleared and the user is bounced to `/login`.

## Honesty rules

- The dashboard renders exactly what the API returns. A `null` rate is shown as **"No data yet"**, never `0%` or a placeholder number.
- Every KPI shows its underlying `n` / denominator so **small samples are visible** (e.g. `1 / 20 drivers`), not smoothed away.
- `match_rate` is labelled a **proxy** — it is not true driver availability.
- Survey-only metrics (trust perception, empty-trip change) are shown as **"Awaiting survey"** — never fabricated.
- Document previews use a short-lived admin-only view URL; when storage is the dev stub the app says the preview is unavailable rather than faking one.

## Setup

```bash
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
npm run dev                    # use PORT=3001 if the API is already on 3000
```

Requires the NestJS API running and a seeded admin account (`ADMIN_EMAIL` / `ADMIN_PASSWORD`, seeded via migration — no public signup).

## Scripts

- `npm run dev` — dev server (Turbopack)
- `npm run build` — production build (runs the TypeScript check)
- `npm run start` — serve the production build
- `npm run lint` — ESLint
