import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Root-level guard tests over repository files (not a package). Run via
// `pnpm test:guard`; wired into the root `pnpm test`.
export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  test: {
    environment: 'node',
    include: ['tests/guard/**/*.test.ts'],
  },
});
