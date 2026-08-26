import { PrismaClient } from "@prisma/client";

/**
 * Wipes the e2e database before the suite runs. DATABASE_URL must point at a
 * disposable database (see playwright.config.ts) — this truncates everything.
 */
export default async function globalSetup() {
  const db = new PrismaClient();
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ShareGrant", "Share", "FileVersion", "File", "Folder", "DataRoom",
      "Account", "User"
    RESTART IDENTITY CASCADE;
  `);
  await db.$disconnect();
}
