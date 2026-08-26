import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { breadcrumbTrail, getOwnedRoom, listChildren } from "@/lib/queries";
import { storageMode } from "@/lib/storage";
import { RoomBrowser } from "@/components/browser/room-browser";

export default async function RoomRootPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { roomId } = await params;
  const room = await getOwnedRoom(user.id, roomId);
  if (!room) notFound();

  const [{ folders, files }, crumbs] = await Promise.all([
    listChildren(room.id, null),
    breadcrumbTrail(room.name, null),
  ]);

  return (
    <RoomBrowser
      roomId={room.id}
      folderId={null}
      crumbs={crumbs}
      folders={folders}
      files={files}
      storageMode={storageMode()}
      ownerEmail={user.email}
    />
  );
}
