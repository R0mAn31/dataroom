import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { breadcrumbTrail, getOwnedRoom, listChildren } from "@/lib/queries";
import { storageMode } from "@/lib/storage";
import { RoomBrowser } from "@/components/browser/room-browser";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ roomId: string; folderId: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { roomId, folderId } = await params;
  const room = await getOwnedRoom(user.id, roomId);
  if (!room) notFound();

  const folder = await db.folder.findUnique({ where: { id: folderId } });
  if (!folder || folder.roomId !== room.id) notFound();

  const [{ folders, files }, crumbs] = await Promise.all([
    listChildren(room.id, folder.id),
    breadcrumbTrail(room.name, folder),
  ]);

  return (
    <RoomBrowser
      roomId={room.id}
      folderId={folder.id}
      crumbs={crumbs}
      folders={folders}
      files={files}
      storageMode={storageMode()}
      ownerEmail={user.email}
    />
  );
}
