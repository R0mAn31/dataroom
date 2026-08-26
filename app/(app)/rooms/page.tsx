import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listRoomsWithStats } from "@/lib/queries";
import { RoomGrid } from "@/components/rooms/room-grid";

export const metadata: Metadata = { title: "Data rooms" };

export default async function RoomsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const rooms = await listRoomsWithStats(user.id);
  return <RoomGrid rooms={rooms} ownerEmail={user.email} />;
}
