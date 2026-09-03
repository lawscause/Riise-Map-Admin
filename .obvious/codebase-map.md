# Codebase Map — RiiseMap Admin

Folder-level overview (depth 2). 348 tracked files.

| Path | Purpose |
|---|---|
| `artifacts/api-server/` | Express 5 REST API (`src/routes/` one file per resource, `src/lib/` auth factory + Cognito adapter, `src/middlewares/` JWT auth + org-scoped user resolution). Bundled by `build.mjs` (esbuild + pino plugin); also packaged for AWS Lambda (`lambda.ts`, `--lambda` flag). |
| `artifacts/riisemap/` | React 19 admin SPA — the product frontend. `src/pages/` one file per route (Home, Learners, Programs, Pathways, FundingSources, Impact, Settings, auth pages), `src/components/` shadcn/ui + feature components, `src/lib/auth.ts` Amplify/Cognito config, `src/data/mockData.ts` design-time mock data. Vite proxies `/api` → `localhost:8080`. |
| `artifacts/mockup-sandbox/` | Standalone Vite app for design mockups/preview. Not part of the dev or deploy flow. |
| `lib/db/` | Drizzle ORM package — `src/schema/index.ts` (21 tables: learners, programs, pathways, funding sources, success stories, org/users, audit log, …), `drizzle.config.ts`, `drizzle/` generated SQL, `seed-db.ts` comprehensive seeder (+ older `.js` variants), connection pool in `src/index.ts`. |
| `lib/api-spec/` | API contract source of truth: `openapi.yaml` + `orval.config.ts` (generates clients). |
| `lib/api-zod/` | Hand-maintained Zod schemas shared by API routes (e.g. healthCheckResponse). |
| `lib/api-client-react/` | Orval-generated React Query API client consumed by the frontend. |
| `scripts/` | Post-merge tooling (`src/`, run via `scripts/post-merge.sh`, wired in `.replit`). |
| `tests/` | Playwright e2e: `auth-flow.spec.ts` (20), `navigation.spec.ts` (37), `crud.spec.ts` (26), `gui-crud.spec.ts`, `api-direct.spec.ts` (hardcoded to prod API + Cognito). |
| `docs/` | `ARCHITECTURE.md` (stack + data model) and `architecture.mmd` (diagram; contains the Cognito pool id). |
| `.kiro/` | Spec-driven development docs: `specs/` (auth-flow-redesign, provider-neutral-identity, …), `steering/git-workflow.md`, `hooks/`. |
| `.github/workflows/` | `deploy-api.yml` — SAM-deploys the API to AWS on push to `main` (uses repo secrets). |
| `attached_assets/` | Static design images aliased as `@assets` in the frontend. |
| Root | `package.json` (workspace scripts: dev/build/typecheck/test:e2e/test:local), `pnpm-workspace.yaml` (packages + catalog + overrides), `pnpm-lock.yaml`, `Dockerfile` (api-server image), `amplify.yml` (frontend build), `template.yaml` (SAM stack), `playwright.config.ts` (prod) / `playwright.local.config.ts` (local), `README.md`/`ARCHITECTURE.md`/`DEPLOY.md`, `backup_*.sql` (prod DB backups — do not commit new ones casually), `.replit` (run buttons/ports). |
