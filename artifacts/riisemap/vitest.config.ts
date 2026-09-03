import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Deliberately separate from vite.config.ts: the app config pulls in Tailwind and
// Replit-only plugins that tests do not need. Only the "@" alias is shared.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
    css: false,
    // Hermetic suite: src/lib/auth.ts throws at module scope when the Cognito
    // vars are absent, so any test that transitively imports it (e.g. pages via
    // UserContext) fails without a developer's local .env. Dummy, non-secret
    // values are enough: the tests mock @/lib/auth-fetch, so no Cognito call is
    // ever made. VITE_API_URL needs no stub — every consumer has a `|| ''` fallback.
    env: {
      VITE_COGNITO_USER_POOL_ID: "test-user-pool-id",
      VITE_COGNITO_CLIENT_ID: "test-client-id",
    },
  },
});
