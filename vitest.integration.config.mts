import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Integration tests: real Postgres (DATABASE_URL must point at a disposable
 * test database), route handlers exercised directly, auth mocked at the
 * lib/auth boundary so we don't need real session cookies.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    hookTimeout: 20_000,
    testTimeout: 10_000,
    // Route handlers share one Prisma client + truncate-between-tests, so
    // concurrent files would stomp on each other's data.
    fileParallelism: false,
  },
});
