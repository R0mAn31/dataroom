import type { File, Folder, Share, ShareGrant } from "@prisma/client";
import { db } from "@/lib/db";

type SessionUser = { id: string; email: string };

export type ShareWithGrants = Share & { grants: ShareGrant[] };

/** The subtree prefix for a folder's descendants (see Folder.path). */
export function childPathOf(folder: Pick<Folder, "id" | "path">): string {
  return `${folder.path}${folder.id}/`;
}

/** Ids of a folder and every folder below it — one indexed prefix query. */
export async function folderSubtreeIds(
  folder: Pick<Folder, "id" | "path" | "roomId">
): Promise<string[]> {
  const descendants = await db.folder.findMany({
    where: { roomId: folder.roomId, path: { startsWith: childPathOf(folder) } },
    select: { id: true },
  });
  return [folder.id, ...descendants.map((f) => f.id)];
}

export async function folderStats(folder: Pick<Folder, "id" | "path" | "roomId">) {
  const ids = await folderSubtreeIds(folder);
  const files = await db.file.aggregate({
    where: { folderId: { in: ids } },
    _count: true,
    _sum: { size: true },
  });
  return {
    folders: ids.length - 1,
    files: files._count,
    bytes: files._sum.size ?? 0,
  };
}

export async function roomStats(roomId: string) {
  const [folders, files] = await Promise.all([
    db.folder.count({ where: { roomId } }),
    db.file.aggregate({ where: { roomId }, _count: true, _sum: { size: true } }),
  ]);
  return { folders, files: files._count, bytes: files._sum.size ?? 0 };
}

// ---------- shares ----------

export type ResolvedShare = {
  share: ShareWithGrants;
  roomName: string;
  /** Display name of whoever owns the room the share points into. */
  ownerLabel: string;
  /** The shared item itself. */
  resource:
    | { type: "ROOM"; roomId: string; name: string }
    | { type: "FOLDER"; folder: Folder }
    | { type: "FILE"; file: File };
};

/**
 * Looks up an active share by its URL token. Returns null when the token is
 * unknown, the share was revoked, or the shared item has since been deleted —
 * callers can't tell these apart on purpose.
 */
export async function resolveShareByToken(
  token: string
): Promise<ResolvedShare | null> {
  const share = await db.share.findUnique({
    where: { token },
    include: {
      grants: true,
      room: {
        select: { name: true, owner: { select: { name: true, email: true } } },
      },
    },
  });
  if (!share || share.revokedAt) return null;

  const base = {
    share,
    roomName: share.room.name,
    ownerLabel: share.room.owner.name ?? share.room.owner.email,
  };

  if (share.resourceType === "ROOM") {
    return {
      ...base,
      resource: { type: "ROOM", roomId: share.roomId, name: share.room.name },
    };
  }
  if (share.resourceType === "FOLDER") {
    const folder = await db.folder.findUnique({ where: { id: share.resourceId } });
    if (!folder) return null;
    return { ...base, resource: { type: "FOLDER", folder } };
  }
  const file = await db.file.findUnique({ where: { id: share.resourceId } });
  if (!file) return null;
  return { ...base, resource: { type: "FILE", file } };
}

/** Whether this visitor may open the share at all. */
export function canUseShare(
  share: ShareWithGrants,
  user: SessionUser | null
): boolean {
  if (share.mode === "PUBLIC") return true;
  if (!user) return false;
  if (share.createdById === user.id) return true;
  return share.grants.some(
    (g) => g.userId === user.id || g.email === user.email
  );
}

/** Whether a folder is inside the subtree a share exposes. */
export async function shareCoversFolder(
  resolved: ResolvedShare,
  folderId: string
): Promise<Folder | null> {
  const folder = await db.folder.findUnique({ where: { id: folderId } });
  if (!folder || folder.roomId !== resolved.share.roomId) return null;

  if (resolved.resource.type === "ROOM") return folder;
  if (resolved.resource.type === "FOLDER") {
    const root = resolved.resource.folder;
    if (folder.id === root.id || folder.path.startsWith(childPathOf(root))) {
      return folder;
    }
  }
  return null;
}

/** Whether a file is inside the subtree a share exposes. */
export async function shareCoversFile(
  resolved: ResolvedShare,
  file: Pick<File, "id" | "roomId" | "folderId">
): Promise<boolean> {
  if (file.roomId !== resolved.share.roomId) return false;
  if (resolved.resource.type === "ROOM") return true;
  if (resolved.resource.type === "FILE") return resolved.resource.file.id === file.id;
  if (!file.folderId) return false;
  return Boolean(await shareCoversFolder(resolved, file.folderId));
}

/**
 * Read access to a file: the room owner, a valid share token that covers it,
 * or a signed-in user with a restricted-share grant that covers it.
 */
export async function canReadFile(
  fileId: string,
  opts: { user: SessionUser | null; shareToken?: string | null }
): Promise<boolean> {
  const file = await db.file.findUnique({
    where: { id: fileId },
    include: { room: { select: { ownerId: true } } },
  });
  if (!file) return false;
  if (opts.user && file.room.ownerId === opts.user.id) return true;

  if (opts.shareToken) {
    const resolved = await resolveShareByToken(opts.shareToken);
    if (
      resolved &&
      canUseShare(resolved.share, opts.user) &&
      (await shareCoversFile(resolved, file))
    ) {
      return true;
    }
  }

  if (opts.user) {
    const shares = await db.share.findMany({
      where: {
        roomId: file.roomId,
        revokedAt: null,
        mode: "RESTRICTED",
        grants: {
          some: { OR: [{ userId: opts.user.id }, { email: opts.user.email }] },
        },
      },
      include: { grants: true, room: { select: { name: true } } },
    });
    for (const share of shares) {
      const resolved = await resolveShareByToken(share.token);
      if (resolved && (await shareCoversFile(resolved, file))) return true;
    }
  }

  return false;
}

/** Items shared with a signed-in user, newest first. Deleted targets are skipped. */
export async function sharedWithUser(user: SessionUser) {
  const grants = await db.shareGrant.findMany({
    where: {
      OR: [{ userId: user.id }, { email: user.email }],
      share: { revokedAt: null },
    },
    include: {
      share: {
        include: {
          room: { select: { name: true } },
          createdBy: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const items = [];
  for (const grant of grants) {
    const { share } = grant;
    let name: string | null = null;
    if (share.resourceType === "ROOM") {
      name = share.room.name;
    } else if (share.resourceType === "FOLDER") {
      const folder = await db.folder.findUnique({
        where: { id: share.resourceId },
        select: { name: true },
      });
      name = folder?.name ?? null;
    } else {
      const file = await db.file.findUnique({
        where: { id: share.resourceId },
        select: { name: true },
      });
      name = file?.name ?? null;
    }
    if (name === null) continue; // target was deleted

    items.push({
      token: share.token,
      resourceType: share.resourceType,
      name,
      roomName: share.room.name,
      sharedBy: share.createdBy.name ?? share.createdBy.email,
      sharedAt: grant.createdAt,
    });
  }
  return items;
}
