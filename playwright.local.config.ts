import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // tests/guard holds Vitest guard tests, not Playwright specs.
  testIgnore: ['**/guard/**'],
  timeout: 60000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  retries: 0,
  reporter: [['list']],
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: true,
    timeout: 30000,
  },
});
