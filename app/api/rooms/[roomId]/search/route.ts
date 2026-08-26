import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApi, requireOwnedRoom, requireUser } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ roomId: string }> };

export const GET = handleApi(async (request: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { roomId } = await params;
  await requireOwnedRoom(user.id, roomId);

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ folders: [], files: [] });

  const [folders, files] = await Promise.all([
    db.folder.findMany({
      where: { roomId, name: { contains: q, mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        parent: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: 10,
    }),
    db.file.findMany({
      where: { roomId, name: { contains: q, mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        size: true,
        mimeType: true,
        folder: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      location: f.parent?.name ?? "Room root",
    })),
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      mimeType: f.mimeType,
      location: f.folder?.name ?? "Room root",
    })),
  });
});
