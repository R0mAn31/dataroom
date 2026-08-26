import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handleApi, requireOwnedRoom, requireUser } from "@/lib/api-helpers";
import { deleteStoredFiles } from "@/lib/storage";
import { isValidName, normalizeName } from "@/lib/names";

type Ctx = { params: Promise<{ roomId: string }> };

const renameSchema = z.object({
  name: z.string().transform(normalizeName).refine(isValidName, "Enter a name."),
});

export const PATCH = handleApi(async (request: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { roomId } = await params;
  await requireOwnedRoom(user.id, roomId);

  const { name } = renameSchema.parse(await request.json());
  const room = await db.dataRoom.update({ where: { id: roomId }, data: { name } });
  return NextResponse.json(room);
});

export const DELETE = handleApi(async (_request: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { roomId } = await params;
  await requireOwnedRoom(user.id, roomId);

  // Collect blob keys before the cascade wipes the metadata.
  const versions = await db.fileVersion.findMany({
    where: { file: { roomId } },
    select: { storageKey: true },
  });

  await db.dataRoom.delete({ where: { id: roomId } });
  await deleteStoredFiles(versions.map((v) => v.storageKey));

  return NextResponse.json({ ok: true });
});
