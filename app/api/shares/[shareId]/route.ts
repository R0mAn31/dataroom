import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, handleApi, requireUser } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ shareId: string }> };

/** Revoke a share — the link stops working for everyone immediately. */
export const DELETE = handleApi(async (_request: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { shareId } = await params;

  const share = await db.share.findUnique({
    where: { id: shareId },
    include: { room: { select: { ownerId: true } } },
  });
  if (!share || share.room.ownerId !== user.id) {
    throw new ApiError(404, "Share not found.");
  }

  await db.share.update({
    where: { id: share.id },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
});
