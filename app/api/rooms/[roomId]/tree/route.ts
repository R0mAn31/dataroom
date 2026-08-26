import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApi, requireOwnedRoom, requireUser } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ roomId: string }> };

/** Flat folder list for the move dialog; the client assembles the tree. */
export const GET = handleApi(async (_request: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { roomId } = await params;
  const room = await requireOwnedRoom(user.id, roomId);

  const folders = await db.folder.findMany({
    where: { roomId },
    select: { id: true, name: true, parentId: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ roomName: room.name, folders });
});
