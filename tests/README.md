# End-to-end tests

Playwright specs in this directory never carry credentials or a deployed-stack URL. They read:

- `E2E_EMAIL` / `E2E_PASSWORD` — a registered account; authenticated specs skip when either is unset.
- `E2E_BASE_URL` — the app under test; defaults to `http://localhost:3000`.
- `E2E_COGNITO_CLIENT_ID` (required by `api-direct.spec.ts`) and `E2E_API_URL` (optional; defaults to `E2E_BASE_URL`, which is right for the local Vite proxy).

Local stack: `pnpm test:local` (starts `pnpm dev` on port 3000). Deployed stack: `E2E_BASE_URL=https://<host> E2E_EMAIL=… E2E_PASSWORD=… pnpm test:e2e` — those specs create and delete rows, so only point them at a stack you own.

`pnpm test:guard` (also part of `pnpm test`) fails if a credential or production hostname is committed here again.
