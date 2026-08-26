import { afterAll, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";

// Hoisted by Vitest to the top of this file, which runs before any test
// file's own imports resolve "@/lib/auth" — every route handler under test
// sees this mock instead of the real session lookup.
vi.mock("@/lib/auth", () => ({
  currentUser: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ShareGrant", "Share", "FileVersion", "File", "Folder", "DataRoom",
      "Account", "User"
    RESTART IDENTITY CASCADE;
  `);
});

afterAll(async () => {
  await db.$disconnect();
});
