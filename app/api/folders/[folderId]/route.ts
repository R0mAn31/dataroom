import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  handleApi,
  jsonError,
  requireOwnedFolder,
  requireUser,
} from "@/lib/api-helpers";
import { folderSubtreeIds } from "@/lib/access";
import { deleteStoredFiles } from "@/lib/storage";
import { isValidName, normalizeName } from "@/lib/names";

type Ctx = { params: Promise<{ folderId: string }> };

const renameSchema = z.object({
  name: z.string().transform(normalizeName).refine(isValidName, "Enter a name."),
});

export const PATCH = handleApi(async (request: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { folderId } = await params;
  const folder = await requireOwnedFolder(user.id, folderId);

  const { name } = renameSchema.parse(await request.json());

  const clash = await db.folder.findFirst({
    where: {
      roomId: folder.roomId,
      parentId: folder.parentId,
      name: { equals: name, mode: "insensitive" },
      id: { not: folder.id },
    },
  });
  if (clash) {
    return jsonError(409, `A folder named “${name}” already exists here.`);
  }

  const updated = await db.folder.update({
    where: { id: folder.id },
    data: { name },
  });
  return NextResponse.json(updated);
});

export const DELETE = handleApi(async (_request: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { folderId } = await params;
  const folder = await requireOwnedFolder(user.id, folderId);

  const subtreeIds = await folderSubtreeIds(folder);
  const files = await db.file.findMany({
    where: { folderId: { in: subtreeIds } },
    select: { id: true, versions: { select: { storageKey: true } } },
  });

  // Anyone holding a share link to something inside sees "no longer available".
  await db.share.updateMany({
    where: {
      roomId: folder.roomId,
      resourceId: { in: [...subtreeIds, ...files.map((f) => f.id)] },
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  await db.folder.delete({ where: { id: folder.id } }); // cascades down
  await deleteStoredFiles(files.flatMap((f) => f.versions.map((v) => v.storageKey)));

  return NextResponse.json({ ok: true });
});
