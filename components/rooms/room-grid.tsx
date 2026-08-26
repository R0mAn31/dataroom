"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FolderClosed,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { formatBytes, formatDate } from "@/lib/format";
import type { RoomListItem, ShareResource } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NameDialog } from "@/components/name-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ShareDialog } from "@/components/share-dialog";

export function RoomGrid({
  rooms,
  ownerEmail,
}: {
  rooms: RoomListItem[];
  ownerEmail: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<RoomListItem | null>(null);
  const [deleting, setDeleting] = useState<RoomListItem | null>(null);
  const [sharing, setSharing] = useState<ShareResource | null>(null);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl tracking-tight">Data rooms</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            One room per deal. Share it, or just a slice of it, when you&apos;re ready.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New room
        </Button>
      </div>

      {rooms.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <li key={room.id} className="relative">
              <Link
                href={`/rooms/${room.id}`}
                className="group block rounded-lg border bg-card p-5 transition-colors hover:border-ring/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="grid size-9 place-items-center rounded-md bg-accent">
                    <FolderClosed className="size-4.5 text-accent-foreground" />
                  </span>
                  {room.shared && (
                    <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                      <Users className="size-3" />
                      Shared
                    </span>
                  )}
                </div>
                <h2 className="mt-3.5 truncate font-medium pr-8">{room.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {room.files === 1 ? "1 file" : `${room.files} files`}
                  {room.folders > 0 &&
                    ` in ${room.folders === 1 ? "1 folder" : `${room.folders} folders`}`}
                </p>
                <p className="mt-3 font-mono text-xs text-muted-foreground">
                  {formatBytes(room.bytes)} · updated {formatDate(room.updatedAt)}
                </p>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-3 bottom-3 size-8 text-muted-foreground"
                    aria-label={`Actions for ${room.name}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      setSharing({ type: "ROOM", id: room.id, name: room.name })
                    }
                  >
                    <UserPlus className="size-4" /> Share
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRenaming(room)}>
                    <Pencil className="size-4" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleting(room)}>
                    <Trash2 className="size-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <NameDialog
        open={creating}
        onOpenChange={setCreating}
        title="New data room"
        description="Name it after the deal — you can rename it any time."
        submitLabel="Create room"
        onSubmit={async (name) => {
          const room = await api<{ id: string }>("/api/rooms", {
            method: "POST",
            json: { name },
          });
          router.push(`/rooms/${room.id}`);
          router.refresh();
        }}
      />

      <NameDialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
        title="Rename data room"
        submitLabel="Rename"
        initialValue={renaming?.name ?? ""}
        onSubmit={async (name) => {
          await api(`/api/rooms/${renaming!.id}`, { method: "PATCH", json: { name } });
          router.refresh();
        }}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.name}”?`}
        description={
          <DeleteRoomWarning room={deleting} />
        }
        confirmLabel="Delete room"
        onConfirm={async () => {
          await api(`/api/rooms/${deleting!.id}`, { method: "DELETE" });
          toast.success(`Deleted “${deleting!.name}”`);
          router.refresh();
        }}
      />

      {sharing && (
        <ShareDialog
          open
          onOpenChange={(open) => !open && setSharing(null)}
          resource={sharing}
          ownerEmail={ownerEmail}
        />
      )}
    </div>
  );
}

function DeleteRoomWarning({ room }: { room: RoomListItem | null }) {
  if (!room) return null;
  const contents =
    room.files === 0 && room.folders === 0
      ? "The room is empty."
      : `Everything inside will be deleted with it: ${
          room.folders > 0
            ? `${room.folders === 1 ? "1 folder" : `${room.folders} folders`} and `
            : ""
        }${room.files === 1 ? "1 file" : `${room.files} files`} (${formatBytes(room.bytes)}).`;
  return (
    <>
      {contents} Share links to this room will stop working. This can&apos;t be undone.
    </>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-20 flex flex-col items-center text-center">
      <span className="grid size-12 place-items-center rounded-lg bg-accent">
        <FolderClosed className="size-5 text-accent-foreground" />
      </span>
      <h2 className="mt-5 font-serif text-xl">No data rooms yet</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        A data room keeps every document for one deal in one place — organized,
        versioned and shareable.
      </p>
      <Button className="mt-6" onClick={onCreate}>
        <Plus className="size-4" />
        Create your first room
      </Button>
    </div>
  );
}
