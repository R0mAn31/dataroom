import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { breadcrumbTrail, getOwnedRoom } from "@/lib/queries";
import { FileView } from "@/components/file-view";

export default async function FilePage({
  params,
}: {
  params: Promise<{ roomId: string; fileId: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { roomId, fileId } = await params;
  const room = await getOwnedRoom(user.id, roomId);
  if (!room) notFound();

  const file = await db.file.findUnique({
    where: { id: fileId },
    include: {
      folder: true,
      versions: { orderBy: { version: "desc" } },
    },
  });
  if (!file || file.roomId !== room.id) notFound();

  const crumbs = await breadcrumbTrail(room.name, file.folder);

  return (
    <FileView
      roomId={room.id}
      crumbs={crumbs}
      ownerEmail={user.email}
      file={{
        id: file.id,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        updatedAt: file.updatedAt.toISOString(),
        folderId: file.folderId,
        versions: file.versions.map((v) => ({
          version: v.version,
          size: v.size,
          createdAt: v.createdAt.toISOString(),
        })),
      }}
    />
  );
}
