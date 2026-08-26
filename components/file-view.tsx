"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Download,
  History,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { formatBytes, formatDate } from "@/lib/format";
import type { Crumb, ShareResource } from "@/lib/types";
import { Breadcrumbs } from "@/components/browser/breadcrumbs";
import { FilePreview } from "@/components/file-preview";
import { MoveFileDialog } from "@/components/browser/move-file-dialog";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { NameDialog } from "@/components/name-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type FileDetails = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  updatedAt: string;
  folderId: string | null;
  versions: { version: number; size: number; createdAt: string }[];
};

export function FileView({
  roomId,
  crumbs,
  file,
  ownerEmail,
}: {
  roomId: string;
  crumbs: Crumb[];
  file: FileDetails;
  ownerEmail: string;
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [sharing, setSharing] = useState<ShareResource | null>(null);

  const parentHref = file.folderId
    ? `/rooms/${roomId}/f/${file.folderId}`
    : `/rooms/${roomId}`;

  const fileCrumbs: Crumb[] = [...crumbs, { id: `file:${file.id}`, name: file.name }];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs
          crumbs={fileCrumbs}
          hrefFor={(crumb) =>
            crumb.id === null
              ? `/rooms/${roomId}`
              : `/rooms/${roomId}/f/${crumb.id}`
          }
        />
        <div className="flex items-center gap-1.5">
          {file.versions.length > 1 && (
            <VersionHistory fileId={file.id} versions={file.versions} />
          )}
          <Button variant="ghost" size="icon" aria-label="Rename" onClick={() => setRenaming(true)}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Move" onClick={() => setMoving(true)}>
            <ArrowRightLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete"
            onClick={() => setDeleting(true)}
          >
            <Trash2 className="size-4" />
          </Button>
          <Button variant="outline" asChild>
            <a href={`/api/files/${file.id}/content?download=1`}>
              <Download className="size-4" />
              Download
            </a>
          </Button>
          <Button
            onClick={() => setSharing({ type: "FILE", id: file.id, name: file.name })}
          >
            <UserPlus className="size-4" />
            Share
          </Button>
        </div>
      </div>

      <p className="mt-1.5 font-mono text-xs text-muted-foreground">
        {formatBytes(file.size)} · updated {formatDate(file.updatedAt)}
        {file.versions.length > 1 && ` · version ${file.versions[0].version}`}
      </p>

      <div className="mt-4 flex-1">
        <FilePreview
          name={file.name}
          mimeType={file.mimeType}
          src={`/api/files/${file.id}/content`}
        />
      </div>

      <NameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Rename file"
        submitLabel="Rename"
        initialValue={file.name}
        selectBaseName
        onSubmit={async (name) => {
          await api(`/api/files/${file.id}`, { method: "PATCH", json: { name } });
          router.refresh();
        }}
      />

      <ConfirmDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete “${file.name}”?`}
        description={
          file.versions.length > 1
            ? `All ${file.versions.length} versions will be permanently deleted. Share links to this file will stop working.`
            : "The file will be permanently deleted. Share links to it will stop working."
        }
        confirmLabel="Delete file"
        onConfirm={async () => {
          await api(`/api/files/${file.id}`, { method: "DELETE" });
          toast.success(`Deleted “${file.name}”`);
          router.push(parentHref);
          router.refresh();
        }}
      />

      {moving && (
        <MoveFileDialog
          open
          onOpenChange={(open) => !open && setMoving(false)}
          file={{
            id: file.id,
            name: file.name,
            size: file.size,
            mimeType: file.mimeType,
            updatedAt: file.updatedAt,
            versions: file.versions.length,
          }}
          roomId={roomId}
          currentFolderId={file.folderId}
          onMoved={() => router.refresh()}
        />
      )}

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

function VersionHistory({
  fileId,
  versions,
}: {
  fileId: string;
  versions: { version: number; size: number; createdAt: string }[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="gap-1.5 text-muted-foreground">
          <History className="size-4" />
          {versions.length} versions
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <p className="px-2 pb-1.5 pt-1 text-xs font-medium text-muted-foreground">
          Version history — uploads with the same name stack here
        </p>
        <ul>
          {versions.map((v, index) => (
            <li key={v.version}>
              <a
                href={`/api/files/${fileId}/content?version=${v.version}&download=1`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span className="font-mono text-xs">
                  v{v.version}
                  {index === 0 && (
                    <span className="ml-1.5 rounded bg-accent px-1.5 py-px text-[11px] text-accent-foreground">
                      current
                    </span>
                  )}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatBytes(v.size)} · {formatDate(v.createdAt)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
