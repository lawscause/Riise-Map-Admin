---
name: local-dev
description: Durable record of the LOCAL-DEV onboarding run for RiiseMap Admin (2026-09-03) — how to stand up Postgres, env, deps, DB seed, dev servers, and e2e verification in this sandbox.
---

# Local Dev — RiiseMap Admin

Verified working on 2026-09-03 in the repo sandbox (snapshot `igtc1c3mmn2w0t1s53g5h`, captured 2026-09-03T15:40:58Z with the full stack running). Everything below was executed and verified in that session; the snapshot already contains steps 1–4.

## What "healthy" looks like

`pnpm dev` (repo root) starts two processes via `concurrently`:
- **api** — esbuild-bundles `artifacts/api-server` then runs `node --env-file=../../.env ./dist/index.js`; logs `Server listening port: 8080`; `curl http://localhost:8080/` → `{"status":"ok"}`
- **web** — Vite on port 3000 (strictPort), serving the SPA; `/api/*` proxied to `http://localhost:8080`

## 1. Tooling (already in the snapshot)

```bash
sudo apt-get update && sudo apt-get install -y postgresql postgresql-client  # Debian 13 → PG 17; no Docker in this sandbox, no compose file in the repo
npm install -g pnpm@10        # pnpm 10, NOT 9 — committed lockfile's overrides (from pnpm-workspace.yaml) only match under pnpm 10
npx playwright install chromium && sudo npx playwright install-deps chromium
```

## 2. Postgres

```bash
sudo pg_ctlcluster 17 main start            # container images don't auto-start the cluster
sudo -u postgres psql -c "CREATE ROLE riisemap LOGIN PASSWORD 'riisemap_local' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE riisemap OWNER riisemap;"
```

## 3. Env files (gitignored — recreate if missing)

`.env` (repo root — consumed by the api dev script via `node --env-file`):

```
DATABASE_URL=postgresql://riisemap:riisemap_local@127.0.0.1:5432/riisemap
PORT=8080
AUTH_PROVIDER=cognito
COGNITO_USER_POOL_ID=us-east-1_butP7gqf1      # committed in docs/architecture.mmd
COGNITO_CLIENT_ID=dvgl229nmkojnubqeupiasp28   # committed in tests/api-direct.spec.ts
```

`artifacts/riisemap/.env` (Vite reads env from the vite root, i.e. this dir — the repo-root `.env` is NOT read by Vite):

```
VITE_COGNITO_USER_POOL_ID=us-east-1_butP7gqf1
VITE_COGNITO_CLIENT_ID=dvgl229nmkojnubqeupiasp28
```

`VITE_API_URL` is optional — unset means same-origin `/api` (Vite proxy). No secrets are needed: all values are committed in the repo. The committed test account for login flows is `info@techsofcolor.org` / `RiiseMap2026!` (see `tests/crud.spec.ts`).

## 4. Database: push → seed → patch

```bash
pnpm install                                                     # frozen-clean under pnpm 10
cd lib/db && DATABASE_URL=postgresql://riisemap:riisemap_local@127.0.0.1:5432/riisemap pnpm exec drizzle-kit push --force
cd .. && pnpm dlx tsx lib/db/seed-db.ts                          # run from REPO ROOT (db client resolves .env from cwd)
```

Gotchas that cost time during onboarding:

- `drizzle.config.ts` dotenv-loads `lib/.env` (its own `../.env`), not the repo root `.env` → always export `DATABASE_URL` for `drizzle-kit`.
- The seeder inserts rows with **explicit `id`s** → Postgres serial sequences stay at 1 → the first API insert fails with `duplicate key value violates unique constraint "pathways_pkey"` (surfaces as POST `/api/pathways` 400). Fix after seeding:

```sql
DO $$
DECLARE r record; seq text;
BEGIN
  FOR r IN SELECT c.relname AS tbl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    seq := pg_get_serial_sequence(r.tbl, 'id');
    IF seq IS NOT NULL THEN
      EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) FROM %I), 0) + 1, false)', seq, r.tbl);
    END IF;
  END LOOP;
END $$;
```

- All list routes are **org-scoped** (`req.dbUser.orgId`). The first authenticated request auto-creates `users` + `organizations` rows for the login (org id 1 with the test account). Seeded rows have `org_id NULL` → invisible in the UI until assigned. Run each UPDATE as a **separate** `psql -c` (multiple statements in one `-c` run as one transaction — one error rolls back all):

```bash
PGPASSWORD=riisemap_local psql -h 127.0.0.1 -U riisemap -d riisemap -c "UPDATE learners SET org_id=1 WHERE org_id IS NULL"
# repeat for: programs, pathways, funding_sources   (success_stories has no org_id column)
```

## 5. Run + verify

```bash
tmux new-session -d -s dev 'cd /home/user/work/Riise-Map-Admin && pnpm dev 2>&1 | tee /tmp/riisemap-dev.log'
sleep 20
curl -s http://localhost:8080/                                   # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/healthz   # 401 without token = auth gate + proxy both working
```

Authenticated smoke test (real Cognito → local API):

```bash
TOKEN=$(curl -s -X POST https://cognito-idp.us-east-1.amazonaws.com/ \
  -H 'Content-Type: application/x-amz-json-1.1' \
  -H 'X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth' \
  -d '{"AuthFlow":"USER_PASSWORD_AUTH","ClientId":"dvgl229nmkojnubqeupiasp28","AuthParameters":{"USERNAME":"info@techsofcolor.org","PASSWORD":"RiiseMap2026!"}}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).AuthenticationResult.IdToken))")
curl -s http://localhost:8080/api/learners -H "Authorization: Bearer $TOKEN"   # → 20 seeded learners
```

## 6. E2E verification (the real gate)

```bash
npx playwright test --config playwright.local.config.ts tests/auth-flow.spec.ts tests/navigation.spec.ts tests/crud.spec.ts
```

Result on 2026-09-03: **83/83 passed** (~2 min; webServer config reuses the running `pnpm dev`). The CRUD specs log in through the UI with the committed Cognito account and create/update/delete funding sources, programs, learners, and pathways against the local DB.

Do NOT run locally without file filters: default `playwright.config.ts` targets prod (`https://app.riisemap.org`) and `tests/api-direct.spec.ts` is hardcoded to the deployed API — both hit production.

## 7. Static checks

- `pnpm run typecheck` — **fails at HEAD** (pre-existing; `lib/db` missing `zod` + `@types/node` deps, and `lib/db/src/index.ts:24` references undefined `envPath`/`result`). Runtime unaffected. Do not treat this as a local-setup regression.
- No lint script and no unit tests exist in this repo.

## History notes

- The sandbox pre-build had installed deps with **bun** (root `package.json` modified with a `workspaces` field + untracked `bun.lock`). That state breaks the canonical dev script (`npx vite` fails with `EINVALIDPACKAGENAME` on the pnpm-style `overrides` keys) — it was reverted to the committed `package.json`, `bun.lock` removed, and deps reinstalled with pnpm 10. Keep the tree clean; pnpm is canonical.
- Sandbox snapshot 2026-09-03T15:40:58Z (`igtc1c3mmn2w0t1s53g5h`) has all of steps 1–4 done and the dev stack running in tmux session `dev`.
