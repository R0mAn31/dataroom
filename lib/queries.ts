import "server-only";
import type { Folder } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  BrowserFile,
  BrowserFolder,
  Crumb,
  RoomListItem,
} from "@/lib/types";

export async function listRoomsWithStats(userId: string): Promise<RoomListItem[]> {
  const rooms = await db.dataRoom.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
  });
  const roomIds = rooms.map((r) => r.id);

  const [fileAgg, folderAgg, shareAgg] = await Promise.all([
    db.file.groupBy({
      by: ["roomId"],
      where: { roomId: { in: roomIds } },
      _count: true,
      _sum: { size: true },
    }),
    db.folder.groupBy({
      by: ["roomId"],
      where: { roomId: { in: roomIds } },
      _count: true,
    }),
    db.share.groupBy({
      by: ["roomId"],
      where: { roomId: { in: roomIds }, revokedAt: null },
      _count: true,
    }),
  ]);

  const files = new Map(fileAgg.map((a) => [a.roomId, a]));
  const folders = new Map(folderAgg.map((a) => [a.roomId, a._count]));
  const shares = new Map(shareAgg.map((a) => [a.roomId, a._count]));

  return rooms.map((room) => ({
    id: room.id,
    name: room.name,
    updatedAt: room.updatedAt.toISOString(),
    files: files.get(room.id)?._count ?? 0,
    folders: folders.get(room.id) ?? 0,
    bytes: files.get(room.id)?._sum.size ?? 0,
    shared: (shares.get(room.id) ?? 0) > 0,
  }));
}

export async function getOwnedRoom(userId: string, roomId: string) {
  const room = await db.dataRoom.findUnique({ where: { id: roomId } });
  if (!room || room.ownerId !== userId) return null;
  return room;
}

/** Folders first, then files — both A→Z, the way a drive is expected to read. */
export async function listChildren(roomId: string, folderId: string | null) {
  const [folders, files] = await Promise.all([
    db.folder.findMany({
      where: { roomId, parentId: folderId },
      orderBy: { name: "asc" },
    }),
    db.file.findMany({
      where: { roomId, folderId },
      orderBy: { name: "asc" },
      include: { _count: { select: { versions: true } } },
    }),
  ]);

  return {
    folders: folders.map(
      (f): BrowserFolder => ({
        id: f.id,
        name: f.name,
        updatedAt: f.updatedAt.toISOString(),
      })
    ),
    files: files.map(
      (f): BrowserFile => ({
        id: f.id,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType,
        updatedAt: f.updatedAt.toISOString(),
        versions: f._count.versions,
      })
    ),
  };
}

/**
 * Breadcrumb trail for a folder: the ancestor ids are already encoded in
 * Folder.path, so this is one query regardless of depth.
 */
export async function breadcrumbTrail(
  rootName: string,
  folder: Folder | null
): Promise<Crumb[]> {
  const crumbs: Crumb[] = [{ id: null, name: rootName }];
  if (!folder) return crumbs;

  const ancestorIds = folder.path.split("/").filter(Boolean);
  if (ancestorIds.length) {
    const ancestors = await db.folder.findMany({
      where: { id: { in: ancestorIds } },
      select: { id: true, name: true },
    });
    const byId = new Map(ancestors.map((a) => [a.id, a.name]));
    for (const id of ancestorIds) {
      const name = byId.get(id);
      if (name) crumbs.push({ id, name });
    }
  }
  crumbs.push({ id: folder.id, name: folder.name });
  return crumbs;
}
