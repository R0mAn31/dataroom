import { vi } from "vitest";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

let userCounter = 0;

export async function createUser(overrides: { email?: string; name?: string } = {}) {
  userCounter += 1;
  const user = await db.user.create({
    data: {
      email: overrides.email ?? `user${userCounter}@test.local`,
      name: overrides.name ?? `Test User ${userCounter}`,
    },
  });
  return { id: user.id, email: user.email, name: user.name };
}

/** Points the mocked `currentUser()` (see setup.ts) at this user. */
export function signInAs(
  user: { id: string; email: string; name?: string | null } | null
) {
  vi.mocked(currentUser).mockResolvedValue(
    user ? { id: user.id, email: user.email, name: user.name ?? null } : null
  );
}

export function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function params<T extends Record<string, string>>(value: T) {
  return { params: Promise.resolve(value) };
}

export async function readJson(response: Response) {
  return response.json();
}
