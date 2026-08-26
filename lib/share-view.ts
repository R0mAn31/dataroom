import "server-only";
import { currentUser } from "@/lib/auth";
import {
  canUseShare,
  resolveShareByToken,
  type ResolvedShare,
} from "@/lib/access";

export type ShareViewContext =
  | { status: "unavailable"; email: string | null }
  | { status: "signin" }
  | { status: "forbidden"; email: string }
  | {
      status: "ok";
      resolved: ResolvedShare;
      user: { id: string; email: string } | null;
    };

/**
 * Shared entry point for every /share/[token] page. "unavailable" covers
 * unknown tokens, revoked shares and deleted targets alike — a visitor can't
 * probe which one it was.
 */
export async function loadShareContext(token: string): Promise<ShareViewContext> {
  const user = await currentUser();
  const resolved = await resolveShareByToken(token);
  if (!resolved) return { status: "unavailable", email: user?.email ?? null };

  if (!canUseShare(resolved.share, user)) {
    return user ? { status: "forbidden", email: user.email } : { status: "signin" };
  }
  return { status: "ok", resolved, user };
}
