"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Download,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { formatBytes, formatItemCount } from "@/lib/format";
import type { StorageMode } from "@/lib/storage";
import type {
  BrowserFile,
  BrowserFolder,
  Crumb,
  ShareResource,
} from "@/lib/types";
import { UploadCancelledError, uploadFile } from "@/lib/upload-client";
import { Breadcrumbs } from "@/components/browser/breadcrumbs";
import { ItemTable } from "@/components/browser/item-table";
import { MoveFileDialog } from "@/components/browser/move-file-dialog";
import { RoomSearch } from "@/components/browser/room-search";
import { UploadPanel, type UploadTask } from "@/components/browser/upload-panel";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { NameDialog } from "@/components/name-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const UPLOAD_CONCURRENCY = 3;

export function RoomBrowser({
  roomId,
  folderId,
  crumbs,
  folders,
  files,
  storageMode,
  ownerEmail,
}: {
  roomId: string;
  folderId: string | null;
  crumbs: Crumb[];
  folders: BrowserFolder[];
  files: BrowserFile[];
  storageMode: StorageMode;
  ownerEmail: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  // Keyed by upload task id — outside React state since neither a File nor
  // an AbortController needs to trigger a re-render on its own.
  const uploadFiles = useRef(new Map<string, File>());
  const uploadControllers = useRef(new Map<string, AbortController>());

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<BrowserFolder | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<BrowserFolder | null>(null);
  const [renamingFile, setRenamingFile] = useState<BrowserFile | null>(null);
  const [deletingFile, setDeletingFile] = useState<BrowserFile | null>(null);
  const [movingFile, setMovingFile] = useState<BrowserFile | null>(null);
  const [sharing, setSharing] = useState<ShareResource | null>(null);
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const here = crumbs[crumbs.length - 1];
  const isEmpty = folders.length === 0 && files.length === 0;

  // ---------- uploads ----------

  function patchTask(id: string, patch: Partial<UploadTask>) {
    setUploads((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  /** Runs one upload attempt end to end; shared by first attempts and retries. */
  async function runUpload(taskId: string) {
    const file = uploadFiles.current.get(taskId);
    if (!file) return;

    const controller = new AbortController();
    uploadControllers.current.set(taskId, controller);
    try {
      const { version } = await uploadFile(
        file,
        { roomId, folderId, mode: storageMode },
        (progress) => patchTask(taskId, { progress }),
        controller.signal
      );
      patchTask(taskId, { status: "done", progress: 100, version });
      router.refresh();
    } catch (err) {
      if (err instanceof UploadCancelledError) {
        patchTask(taskId, { status: "cancelled" });
      } else {
        patchTask(taskId, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed. Try again.",
        });
      }
    } finally {
      uploadControllers.current.delete(taskId);
    }
  }

  function startUploads(incoming: File[]) {
    if (!incoming.length) return;
    const taskIds = incoming.map((file) => {
      const id = crypto.randomUUID();
      uploadFiles.current.set(id, file);
      return id;
    });
    setUploads((prev) => [
      ...prev,
      ...incoming.map((file, i) => ({
        id: taskIds[i],
        name: file.name,
        size: file.size,
        progress: 0,
        status: "uploading" as const,
      })),
    ]);

    const pending = [...taskIds];
    // Fire-and-forget: each worker pulls the next queued id until empty.
    // Cancel/retry act on individual tasks and don't block this queue.
    for (let worker = 0; worker < Math.min(UPLOAD_CONCURRENCY, pending.length); worker++) {
      (async () => {
        for (let id = pending.shift(); id; id = pending.shift()) {
          await runUpload(id);
        }
      })();
    }
  }

  function cancelUpload(taskId: string) {
    uploadControllers.current.get(taskId)?.abort();
  }

  function retryUpload(taskId: string) {
    patchTask(taskId, { status: "uploading", progress: 0, error: undefined });
    runUpload(taskId);
  }

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    startUploads(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  // ---------- drag & drop ----------

  function hasFiles(event: React.DragEvent) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function handleDragEnter(event: React.DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    if (!hasFiles(event)) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragActive(false);
    }
  }

  function handleDrop(event: React.DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    startUploads(Array.from(event.dataTransfer.files));
  }

  // Reset the drag counter if the drag ends outside the window.
  useEffect(() => {
    const reset = () => {
      dragDepth.current = 0;
      setDragActive(false);
    };
    window.addEventListener("dragend", reset);
    return () => window.removeEventListener("dragend", reset);
  }, []);

  return (
    <div
      className="relative flex flex-1 flex-col"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => hasFiles(e) && e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            crumbs={crumbs}
            hrefFor={(crumb) =>
              crumb.id === null ? `/rooms/${roomId}` : `/rooms/${roomId}/f/${crumb.id}`
            }
          />
          <div className="flex items-center gap-2">
            <RoomSearch roomId={roomId} />
            <Button
              variant="outline"
              onClick={() =>
                setSharing(
                  folderId
                    ? { type: "FOLDER", id: folderId, name: here.name }
                    : { type: "ROOM", id: roomId, name: here.name }
                )
              }
            >
              <UserPlus className="size-4" />
              Share
            </Button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" />
              Upload files
            </Button>
            <Button variant="outline" onClick={() => setCreatingFolder(true)}>
              <FolderPlus className="size-4" />
              New folder
            </Button>
          </div>
          {!isEmpty && (
            <p className="text-xs text-muted-foreground">
              {formatItemCount(folders.length + files.length)}
            </p>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
          aria-hidden
        />

        <div className="mt-4 flex-1">
          {isEmpty ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="grid min-h-64 w-full place-items-center rounded-lg border-2 border-dashed text-center transition-colors hover:border-ring/60 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>
                <Upload className="mx-auto size-6 text-muted-foreground" />
                <span className="mt-3 block font-medium">
                  Drop files here, or click to browse
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  This {folderId ? "folder" : "room"} is empty. PDFs preview right in
                  the browser.
                </span>
              </span>
            </button>
          ) : (
            <ItemTable
              folders={folders}
              files={files}
              folderHref={(id) => `/rooms/${roomId}/f/${id}`}
              fileHref={(id) => `/rooms/${roomId}/file/${id}`}
              actions={{
                folder: (folder) => (
                  <FolderMenu
                    folder={folder}
                    onShare={() =>
                      setSharing({ type: "FOLDER", id: folder.id, name: folder.name })
                    }
                    onRename={() => setRenamingFolder(folder)}
                    onDelete={() => setDeletingFolder(folder)}
                  />
                ),
                file: (file) => (
                  <FileMenu
                    file={file}
                    onShare={() =>
                      setSharing({ type: "FILE", id: file.id, name: file.name })
                    }
                    onRename={() => setRenamingFile(file)}
                    onMove={() => setMovingFile(file)}
                    onDelete={() => setDeletingFile(file)}
                  />
                ),
              }}
            />
          )}
        </div>
      </div>

      {dragActive && (
        <div className="pointer-events-none absolute inset-3 z-40 grid place-items-center rounded-lg border-2 border-dashed border-primary bg-background/85">
          <div className="text-center">
            <Upload className="mx-auto size-7 text-primary" />
            <p className="mt-2 font-medium">
              Drop to upload to “{here.name}”
            </p>
          </div>
        </div>
      )}

      {/* ---------- dialogs ---------- */}

      <NameDialog
        open={creatingFolder}
        onOpenChange={setCreatingFolder}
        title="New folder"
        submitLabel="Create folder"
        initialValue="New folder"
        onSubmit={async (name) => {
          await api("/api/folders", {
            method: "POST",
            json: { roomId, parentId: folderId, name },
          });
          router.refresh();
        }}
      />

      <NameDialog
        open={renamingFolder !== null}
        onOpenChange={(open) => !open && setRenamingFolder(null)}
        title="Rename folder"
        submitLabel="Rename"
        initialValue={renamingFolder?.name ?? ""}
        onSubmit={async (name) => {
          await api(`/api/folders/${renamingFolder!.id}`, {
            method: "PATCH",
            json: { name },
          });
          router.refresh();
        }}
      />

      <NameDialog
        open={renamingFile !== null}
        onOpenChange={(open) => !open && setRenamingFile(null)}
        title="Rename file"
        submitLabel="Rename"
        initialValue={renamingFile?.name ?? ""}
        selectBaseName
        onSubmit={async (name) => {
          await api(`/api/files/${renamingFile!.id}`, {
            method: "PATCH",
            json: { name },
          });
          router.refresh();
        }}
      />

      {deletingFolder && (
        <DeleteFolderDialog
          folder={deletingFolder}
          onOpenChange={(open) => !open && setDeletingFolder(null)}
          onDeleted={() => router.refresh()}
        />
      )}

      <ConfirmDeleteDialog
        open={deletingFile !== null}
        onOpenChange={(open) => !open && setDeletingFile(null)}
        title={`Delete “${deletingFile?.name}”?`}
        description={
          deletingFile && deletingFile.versions > 1
            ? `All ${deletingFile.versions} versions will be permanently deleted. Share links to this file will stop working.`
            : "The file will be permanently deleted. Share links to it will stop working."
        }
        confirmLabel="Delete file"
        onConfirm={async () => {
          await api(`/api/files/${deletingFile!.id}`, { method: "DELETE" });
          toast.success(`Deleted “${deletingFile!.name}”`);
          router.refresh();
        }}
      />

      {movingFile && (
        <MoveFileDialog
          open
          onOpenChange={(open) => !open && setMovingFile(null)}
          file={movingFile}
          roomId={roomId}
          currentFolderId={folderId}
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

      <UploadPanel
        tasks={uploads}
        onClear={() =>
          setUploads((prev) => {
            const keep = prev.filter((t) => t.status === "uploading");
            const keepIds = new Set(keep.map((t) => t.id));
            for (const id of uploadFiles.current.keys()) {
              if (!keepIds.has(id)) uploadFiles.current.delete(id);
            }
            return keep;
          })
        }
        onCancel={cancelUpload}
        onRetry={retryUpload}
      />
    </div>
  );
}

// ---------- row menus ----------

// Spreads Radix trigger props through so `asChild` works on it.
function RowMenuButton({
  label,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground transition-opacity focus-visible:opacity-100 data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100"
      aria-label={label}
      {...props}
    >
      <MoreHorizontal className="size-4" />
    </Button>
  );
}

function FolderMenu({
  folder,
  onShare,
  onRename,
  onDelete,
}: {
  folder: BrowserFolder;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <RowMenuButton label={`Actions for ${folder.name}`} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onShare}>
          <UserPlus className="size-4" /> Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="size-4" /> Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FileMenu({
  file,
  onShare,
  onRename,
  onMove,
  onDelete,
}: {
  file: BrowserFile;
  onShare: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <RowMenuButton label={`Actions for ${file.name}`} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onShare}>
          <UserPlus className="size-4" /> Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="size-4" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMove}>
          <ArrowRightLeft className="size-4" /> Move
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`/api/files/${file.id}/content?download=1`}>
            <Download className="size-4" /> Download
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------- delete folder (loads subtree stats first) ----------

function DeleteFolderDialog({
  folder,
  onOpenChange,
  onDeleted,
}: {
  folder: BrowserFolder;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [stats, setStats] = useState<{
    folders: number;
    files: number;
    bytes: number;
  } | null>(null);

  useEffect(() => {
    api<{ folders: number; files: number; bytes: number }>(
      `/api/folders/${folder.id}/stats`
    )
      .then(setStats)
      .catch(() => setStats({ folders: 0, files: 0, bytes: 0 }));
  }, [folder.id]);

  let contents = "Checking what's inside…";
  if (stats) {
    contents =
      stats.folders === 0 && stats.files === 0
        ? "The folder is empty."
        : `Everything inside will be deleted with it: ${
            stats.folders > 0
              ? `${stats.folders === 1 ? "1 folder" : `${stats.folders} folders`} and `
              : ""
          }${stats.files === 1 ? "1 file" : `${stats.files} files`} (${formatBytes(
            stats.bytes
          )}).`;
  }

  return (
    <ConfirmDeleteDialog
      open
      onOpenChange={onOpenChange}
      title={`Delete “${folder.name}”?`}
      description={`${contents} Share links to anything inside will stop working. This can't be undone.`}
      confirmLabel="Delete folder"
      onConfirm={async () => {
        await api(`/api/folders/${folder.id}`, { method: "DELETE" });
        toast.success(`Deleted “${folder.name}”`);
        onDeleted();
      }}
    />
  );
}
