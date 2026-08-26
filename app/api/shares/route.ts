import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import type { ShareResourceType } from "@prisma/client";
import { db } from "@/lib/db";
import {
  ApiError,
  handleApi,
  requireOwnedFile,
  requireOwnedFolder,
  requireOwnedRoom,
  requireUser,
} from "@/lib/api-helpers";

const resourceSchema = z.object({
  resourceType: z.enum(["ROOM", "FOLDER", "FILE"]),
  resourceId: z.string(),
});

/** Verifies the caller owns the resource; returns the room id it lives in. */
async function requireOwnedResource(
  userId: string,
  resourceType: ShareResourceType,
  resourceId: string
): Promise<string> {
  if (resourceType === "ROOM") {
    return (await requireOwnedRoom(userId, resourceId)).id;
  }
  if (resourceType === "FOLDER") {
    return (await requireOwnedFolder(userId, resourceId)).roomId;
  }
  return (await requireOwnedFile(userId, resourceId)).roomId;
}

/** Current sharing state of one resource, for the share dialog. */
export const GET = handleApi(async (request: Request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const { resourceType, resourceId } = resourceSchema.parse({
    resourceType: url.searchParams.get("resourceType"),
    resourceId: url.searchParams.get("resourceId"),
  });
  await requireOwnedResource(user.id, resourceType, resourceId);

  const shares = await db.share.findMany({
    where: { resourceType, resourceId, revokedAt: null },
    include: { grants: { orderBy: { createdAt: "asc" } } },
  });

  const publicShare = shares.find((s) => s.mode === "PUBLIC") ?? null;
  const restricted = shares.find((s) => s.mode === "RESTRICTED") ?? null;

  return NextResponse.json({
    public: publicShare && { id: publicShare.id, token: publicShare.token },
    restricted: restricted && {
      id: restricted.id,
      token: restricted.token,
      grants: restricted.grants.map((g) => ({ id: g.id, email: g.email })),
    },
  });
});

const mutateSchema = z.discriminatedUnion("action", [
  resourceSchema.extend({ action: z.literal("enable_public") }),
  resourceSchema.extend({
    action: z.literal("invite"),
    emails: z.array(z.email("Enter valid email addresses.")).min(1).max(50),
  }),
]);

export const POST = handleApi(async (request: Request) => {
  const user = await requireUser();
  const input = mutateSchema.parse(await request.json());
  const roomId = await requireOwnedResource(
    user.id,
    input.resourceType,
    input.resourceId
  );

  const shareBase = {
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    roomId,
    createdById: user.id,
    token: crypto.randomBytes(16).toString("base64url"),
  };

  if (input.action === "enable_public") {
    const existing = await db.share.findFirst({
      where: {
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        mode: "PUBLIC",
        revokedAt: null,
      },
    });
    const share =
      existing ??
      (await db.share.create({ data: { ...shareBase, mode: "PUBLIC" } }));
    return NextResponse.json({ id: share.id, token: share.token });
  }

  // invite
  const emails = [...new Set(input.emails.map((e) => e.toLowerCase()))];
  if (emails.includes(user.email)) {
    throw new ApiError(400, "You already have access as the owner.");
  }

  let share = await db.share.findFirst({
    where: {
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      mode: "RESTRICTED",
      revokedAt: null,
    },
  });
  share ??= await db.share.create({ data: { ...shareBase, mode: "RESTRICTED" } });

  const users = await db.user.findMany({ where: { email: { in: emails } } });
  const userIdByEmail = new Map(users.map((u) => [u.email, u.id]));

  await db.shareGrant.createMany({
    data: emails.map((email) => ({
      shareId: share.id,
      email,
      userId: userIdByEmail.get(email) ?? null,
    })),
    skipDuplicates: true,
  });

  const grants = await db.shareGrant.findMany({
    where: { shareId: share.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    id: share.id,
    token: share.token,
    grants: grants.map((g) => ({ id: g.id, email: g.email })),
  });
});
