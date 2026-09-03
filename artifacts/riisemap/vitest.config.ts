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
  },
});
