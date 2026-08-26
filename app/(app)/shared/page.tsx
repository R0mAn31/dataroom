import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { File, Folder, FolderClosed, Users } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { sharedWithUser } from "@/lib/access";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Shared with me" };

const TYPE_ICON = { ROOM: FolderClosed, FOLDER: Folder, FILE: File } as const;

export default async function SharedPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const items = await sharedWithUser(user);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="font-serif text-2xl tracking-tight">Shared with me</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Rooms, folders and files other people gave you access to. View only.
      </p>

      {items.length === 0 ? (
        <div className="mt-20 flex flex-col items-center text-center">
          <span className="grid size-12 place-items-center rounded-lg bg-accent">
            <Users className="size-5 text-accent-foreground" />
          </span>
          <h2 className="mt-5 font-serif text-xl">Nothing shared with you yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            When someone invites {user.email} to a data room, a folder or a file,
            it shows up here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y rounded-lg border bg-card">
          {items.map((item) => {
            const Icon = TYPE_ICON[item.resourceType];
            return (
              <li key={item.token}>
                <Link
                  href={`/share/${item.token}`}
                  className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent">
                    <Icon className="size-4 text-accent-foreground" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.resourceType !== "ROOM" && `In ${item.roomName} · `}
                      Shared by {item.sharedBy}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {formatDate(item.sharedAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
