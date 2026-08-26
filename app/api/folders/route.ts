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
import { childPathOf } from "@/lib/access";
import { isValidName, nextAvailableName, normalizeName } from "@/lib/names";

const createSchema = z.object({
  roomId: z.string(),
  parentId: z.string().nullish(),
  name: z.string().transform(normalizeName).refine(isValidName, "Enter a name."),
});

export const POST = handleApi(async (request: Request) => {
  const user = await requireUser();
  const { roomId, parentId, name } = createSchema.parse(await request.json());
  await requireOwnedRoom(user.id, roomId);

  let path = "/";
  if (parentId) {
    const parent = await requireOwnedFolder(user.id, parentId);
    if (parent.roomId !== roomId) throw new ApiError(400, "Folder not found.");
    path = childPathOf(parent);
  }

  // "New folder" twice shouldn't fail — suffix the way Finder/Drive do.
  const siblings = await db.folder.findMany({
    where: { roomId, parentId: parentId ?? null },
    select: { name: true },
  });
  const finalName = nextAvailableName(
    name,
    new Set(siblings.map((s) => s.name.toLowerCase())),
    false
  );

  const folder = await db.folder.create({
    data: { name: finalName, roomId, parentId: parentId ?? null, path },
  });
  await db.dataRoom.update({ where: { id: roomId }, data: { updatedAt: new Date() } });

  return NextResponse.json(folder, { status: 201 });
});
