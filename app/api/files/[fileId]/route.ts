import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ApiError,
  handleApi,
  jsonError,
  requireOwnedFile,
  requireOwnedFolder,
  requireUser,
} from "@/lib/api-helpers";
import { deleteStoredFiles } from "@/lib/storage";
import {
  isValidName,
  nextAvailableName,
  normalizeName,
} from "@/lib/names";

type Ctx = { params: Promise<{ fileId: string }> };

const updateSchema = z
  .object({
    name: z
      .string()
      .transform(normalizeName)
      .refine(isValidName, "Invalid file name.")
      .optional(),
    // Present = move; null moves to the room root.
    folderId: z.string().nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.folderId !== undefined, {
    message: "Nothing to update.",
  });

export const PATCH = handleApi(async (request: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { fileId } = await params;
  const file = await requireOwnedFile(user.id, fileId);

  const input = updateSchema.parse(await request.json());

  // Rename: same-folder name clashes are the user's call to resolve.
  if (input.name !== undefined && input.folderId === undefined) {
    const clash = await db.file.findFirst({
      where: {
        roomId: file.roomId,
        folderId: file.folderId,
        name: { equals: input.name, mode: "insensitive" },
        id: { not: file.id },
      },
    });
    if (clash) {
      return jsonError(409, `A file named “${input.name}” already exists here.`);
    }
    const updated = await db.file.update({
      where: { id: file.id },
      data: { name: input.name },
    });
    return NextResponse.json({ file: updated });
  }

  // Move: a clash in the destination is resolved automatically with a suffix.
  const targetFolderId = input.folderId ?? null;
  if (targetFolderId) {
    const target = await requireOwnedFolder(user.id, targetFolderId);
    if (target.roomId !== file.roomId) {
      throw new ApiError(400, "Files can only move within their data room.");
    }
  }
  if (targetFolderId === file.folderId) {
    return NextResponse.json({ file, renamedTo: null });
  }

  const neighbors = await db.file.findMany({
    where: { roomId: file.roomId, folderId: targetFolderId },
    select: { name: true },
  });
  const finalName = nextAvailableName(
    input.name ?? file.name,
    new Set(neighbors.map((n) => n.name.toLowerCase())),
    true
  );

  const updated = await db.file.update({
    where: { id: file.id },
    data: { folderId: targetFolderId, name: finalName },
  });
  return NextResponse.json({
    file: updated,
    renamedTo: finalName !== file.name ? finalName : null,
  });
});

export const DELETE = handleApi(async (_request: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { fileId } = await params;
  const file = await requireOwnedFile(user.id, fileId);

  const versions = await db.fileVersion.findMany({
    where: { fileId: file.id },
    select: { storageKey: true },
  });

  await db.share.updateMany({
    where: { resourceId: file.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await db.file.delete({ where: { id: file.id } });
  await deleteStoredFiles(versions.map((v) => v.storageKey));

  return NextResponse.json({ ok: true });
});
