import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Route-handler wrapper: auth/validation failures become clean JSON errors. */
export function handleApi<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse | Response>
) {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) return jsonError(err.status, err.message);
      if (err instanceof ZodError) {
        return jsonError(400, err.issues[0]?.message ?? "Invalid request");
      }
      console.error(err);
      return jsonError(500, "Something went wrong. Try again.");
    }
  };
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "You need to sign in first.");
  return user;
}

/** Room owned by the user, or 404 (existence is not revealed to others). */
export async function requireOwnedRoom(userId: string, roomId: string) {
  const room = await db.dataRoom.findUnique({ where: { id: roomId } });
  if (!room || room.ownerId !== userId) {
    throw new ApiError(404, "Data room not found.");
  }
  return room;
}

export async function requireOwnedFolder(userId: string, folderId: string) {
  const folder = await db.folder.findUnique({
    where: { id: folderId },
    include: { room: { select: { ownerId: true } } },
  });
  if (!folder || folder.room.ownerId !== userId) {
    throw new ApiError(404, "Folder not found.");
  }
  return folder;
}

export async function requireOwnedFile(userId: string, fileId: string) {
  const file = await db.file.findUnique({
    where: { id: fileId },
    include: { room: { select: { ownerId: true } } },
  });
  if (!file || file.room.ownerId !== userId) {
    throw new ApiError(404, "File not found.");
  }
  return file;
}
