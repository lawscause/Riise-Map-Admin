# RiiseMap Admin — Agent Guide

Repo: `lawscause/Riise-Map-Admin` — organization-side admin platform for funded programs, learner progress tracking, and impact reports. pnpm workspace monorepo.

## Stack

| Layer | Technology |
|---|---|
| Package manager | pnpm 10 (workspace + catalog in `pnpm-workspace.yaml`; see "pnpm version" gotcha below) |
| Runtime | Node.js 20+ (CI uses 24), TypeScript 5.9 |
| API | `artifacts/api-server` — Express 5, esbuild bundle (`build.mjs`), pino logging, port **8080** |
| Web | `artifacts/riisemap` — React 19, Vite 7, Tailwind 4, shadcn/ui, wouter, TanStack Query, Recharts, port **3000** (`/api` proxied to `http://localhost:8080`) |
| Database | PostgreSQL + Drizzle ORM (21 tables, push-based via `drizzle-kit push`) |
| Auth | AWS Cognito user pool `us-east-1_butP7gqf1` — frontend `aws-amplify` v6, API verifies JWTs with `jose` (JWKS) |
| Tests | Playwright e2e (local config + prod config) |
| Deploy | API → AWS Lambda via SAM (`template.yaml`); web → AWS Amplify (`amplify.yml`) |

## Commands

```bash
# One-time bootstrap (see skills/local-dev/SKILL.md for full detail)
sudo apt-get install -y postgresql && sudo pg_ctlcluster 17 main start   # no Docker/compose in this repo
npm install -g pnpm@10
pnpm install                              # committed lockfile installs clean under pnpm 10

# Local env files (both gitignored — recreate on a fresh sandbox)
#   .env                        → DATABASE_URL, PORT=8080, AUTH_PROVIDER=cognito,
#                                 COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID
#   artifacts/riisemap/.env     → VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_CLIENT_ID

# Database: create → push schema → seed → fix sequences (SKILL.md has exact SQL)
cd lib/db && DATABASE_URL=<local url> pnpm exec drizzle-kit push --force
pnpm dlx tsx lib/db/seed-db.ts            # MUST run from repo root

# Dev (canonical): starts API on 8080 + web on 3000 via concurrently
pnpm dev

# Verify
curl -s http://localhost:8080/            # → {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/healthz   # → 401 (auth gate works)

# E2E tests (local stack; webServer reuses a running `pnpm dev`)
npx playwright test --config playwright.local.config.ts tests/auth-flow.spec.ts tests/navigation.spec.ts tests/crud.spec.ts

# Static checks
pnpm run typecheck                        # KNOWN FAILURE at HEAD — see Known Issues
```

Playwright browsers: `npx playwright install chromium` (+ `sudo npx playwright install-deps chromium`).

Default `playwright.config.ts` targets **production** (`https://app.riisemap.org`); always pass `--config playwright.local.config.ts` for local runs. `tests/api-direct.spec.ts` is hardcoded to the deployed API — exclude it locally.

## Codebase Map

See `codebase-map.md`.

## Local Verification Summary

- **Date:** 2026-09-03 (UTC) — dev_stack_healthy: **true**
- **Stack:** PostgreSQL 17.11 (apt, db `riisemap`, 21 tables via `drizzle-kit push`, seeded via `lib/db/seed-db.ts`, serial sequences advanced) + API on 8080 + Vite 7.3.5 on 3000, started with `pnpm dev`
- **Auth:** real Cognito login verified end-to-end through the local UI with the committed test account (`info@techsofcolor.org` / `RiiseMap2026!`, see `tests/crud.spec.ts`)
- **Primary flow evidence:** Playwright local run **83/83 passed** (auth-flow 20, navigation 37, crud 26) against `http://localhost:3000` → Vite `/api` proxy → local API → local Postgres. CRUD exercised through the UI: funding sources, programs, learners, pathways (create/update/delete). 5 screenshots captured (login, home, learners, programs, impact); zero browser console errors.
- **API-level evidence:** authenticated `GET /api/learners` → 200 with 20 seeded learners; first authenticated request auto-provisions `users` + `organizations` rows (org-scoped queries)
- **Typecheck:** FAILS at HEAD (pre-existing, 3 errors in `lib/db`) — see Known Issues
- **Lint:** no lint script exists in the repo (only `prettier` as a devDep, no config)
- **Unit tests:** none — `tests/` contains Playwright e2e specs only

## Sandbox Snapshot

- Captured **2026-09-03T15:40:58Z** from live session `igtc1c3mmn2w0t1s53g5h` (E2B template `ub28y2lil27eb1zmexvz:default`)
- State baked in: pnpm 10.34.5 + PostgreSQL 17 installed; deps installed; DB `riisemap` provisioned, seeded, sequences fixed; dev stack running in tmux session `dev` (API 8080 + web 3000); Playwright Chromium installed; local `.env` files in place

## Known Issues / Gotchas

1. **`pnpm run typecheck` fails at HEAD** (pre-existing, unrelated to runtime): `lib/db/src/index.ts:24` references undefined `envPath`/`result`; `lib/db/src/schema/index.ts:3` imports `zod` which is not a `lib/db` dependency; `lib/db` sets `types: ["node"]` without depending on `@types/node`. Runtime is unaffected (esbuild bundles without typechecking). No CI workflow runs typecheck.
2. **pnpm version:** committed `pnpm-lock.yaml` records `overrides` from `pnpm-workspace.yaml` (a pnpm-10 feature). `pnpm install --frozen-lockfile` fails under pnpm 9 ("overrides configuration doesn't match"); CI/amplify use pnpm 9 + `--no-frozen-lockfile` which regenerates. Use **pnpm 10** locally.
3. **Seed leaves serial sequences behind:** `seed-db.ts` inserts rows with explicit `id`s, so the next API insert collides (`pathways_pkey` duplicate key → POST `/api/pathways` 400). Advance all sequences after seeding (SQL in SKILL.md).
4. **Routes are org-scoped:** the first authenticated request creates `users`/`organizations` rows; seeded data is invisible until you `UPDATE ... SET org_id` to that org (SQL in SKILL.md).
5. `drizzle.config.ts` dotenv loads `lib/.env` (not the repo root `.env`) — export `DATABASE_URL` when running `drizzle-kit`.
6. `lib/db/src/index.ts` resolves `.env` from the **process cwd** — run seed scripts from the repo root.
7. Production deploys fire on push to `main` (`.github/workflows/deploy-api.yml` SAM-deploys the API with prod secrets). Be deliberate about pushes to `main`.
