import { defineConfig } from "vitest/config";
import path from "path";

/** Unit tests: pure functions, no DB, no mocking. */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."), // mirrors tsconfig's "@/*"
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
