import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ApiError,
  handleApi,
  requireOwnedFolder,
  requireOwnedRoom,
  requireUser,
} from "@/lib/api-helpers";
import { isValidName, normalizeName } from "@/lib/names";

const registerSchema = z.object({
  roomId: z.string(),
  folderId: z.string().nullish(),
  name: z.string().transform(normalizeName).refine(isValidName, "Invalid file name."),
  size: z.number().int().nonnegative(),
  mimeType: z.string().max(255),
  storageKey: z.string().min(1),
});

/**
 * Registers an uploaded object as a file. Called after the bytes have landed
 * in storage (local route or direct-to-Blob). If a file with the same name
 * already exists in the target folder, the upload becomes its next version.
 */
export const POST = handleApi(async (request: Request) => {
  const user = await requireUser();
  const input = registerSchema.parse(await request.json());
  await requireOwnedRoom(user.id, input.roomId);

  if (input.folderId) {
    const folder = await requireOwnedFolder(user.id, input.folderId);
    if (folder.roomId !== input.roomId) throw new ApiError(400, "Folder not found.");
  }

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.file.findFirst({
      where: {
        roomId: input.roomId,
        folderId: input.folderId ?? null,
        name: { equals: input.name, mode: "insensitive" },
      },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });

    if (existing) {
      const nextVersion = (existing.versions[0]?.version ?? 0) + 1;
      await tx.fileVersion.create({
        data: {
          fileId: existing.id,
          version: nextVersion,
          storageKey: input.storageKey,
          size: input.size,
        },
      });
      const file = await tx.file.update({
        where: { id: existing.id },
        data: { size: input.size, mimeType: input.mimeType },
      });
      return { file, version: nextVersion };
    }

    const file = await tx.file.create({
      data: {
        name: input.name,
        roomId: input.roomId,
        folderId: input.folderId ?? null,
        size: input.size,
        mimeType: input.mimeType,
      },
    });
    await tx.fileVersion.create({
      data: { fileId: file.id, version: 1, storageKey: input.storageKey, size: input.size },
    });
    return { file, version: 1 };
  });

  await db.dataRoom.update({
    where: { id: input.roomId },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(result, { status: 201 });
});
