import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    // Each file boots its own in-process PGlite instance; keep them isolated.
    fileParallelism: false,
    env: {
      // Tell @workspace/db not to open a node-postgres pool; the harness injects PGlite.
      DB_DRIVER: "injected",
      LOG_LEVEL: "silent",
    },
  },
});
