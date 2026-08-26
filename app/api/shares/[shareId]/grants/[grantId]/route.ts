import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, handleApi, requireUser } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ shareId: string; grantId: string }> };

/** Remove one person's access from a restricted share. */
export const DELETE = handleApi(async (_request: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { shareId, grantId } = await params;

  const grant = await db.shareGrant.findUnique({
    where: { id: grantId },
    include: {
      share: { include: { room: { select: { ownerId: true } } } },
    },
  });
  if (
    !grant ||
    grant.shareId !== shareId ||
    grant.share.room.ownerId !== user.id
  ) {
    throw new ApiError(404, "Access grant not found.");
  }

  await db.shareGrant.delete({ where: { id: grant.id } });
  return NextResponse.json({ ok: true });
});
