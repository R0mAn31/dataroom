"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Folder, FolderClosed } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import type { BrowserFile, TreeFolder } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type MoveFileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: BrowserFile;
  roomId: string;
  currentFolderId: string | null;
  onMoved: () => void;
};

export function MoveFileDialog(props: MoveFileDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <MoveDialogBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

type Tree = { roomName: string; folders: TreeFolder[] };

/** Mounted fresh on open; loads the room's folder tree once. */
function MoveDialogBody({
  onOpenChange,
  file,
  roomId,
  currentFolderId,
  onMoved,
}: MoveFileDialogProps) {
  const [tree, setTree] = useState<Tree | null>(null);
  const [selected, setSelected] = useState<string | null>(currentFolderId);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api<Tree>(`/api/rooms/${roomId}/tree`)
      .then(setTree)
      .catch(() => {
        toast.error("Couldn't load folders. Try again.");
        onOpenChange(false);
      });
  }, [roomId, onOpenChange]);

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, TreeFolder[]>();
    for (const folder of tree?.folders ?? []) {
      const list = map.get(folder.parentId) ?? [];
      list.push(folder);
      map.set(folder.parentId, list);
    }
    return map;
  }, [tree]);

  async function move() {
    setPending(true);
    try {
      const result = await api<{ renamedTo: string | null }>(`/api/files/${file.id}`, {
        method: "PATCH",
        json: { folderId: selected },
      });
      toast.success(
        result.renamedTo
          ? `Moved and renamed to “${result.renamedTo}” — a file with that name was already there.`
          : `Moved “${file.name}”`
      );
      onOpenChange(false);
      onMoved();
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Something went wrong. Try again."
      );
      setPending(false);
    }
  }

  // Everything starts expanded — hunting for a collapsed destination is worse
  // than a long list, and deal rooms rarely nest deep.
  function renderLevel(parentId: string | null, depth: number): React.ReactNode {
    const children = childrenOf.get(parentId) ?? [];
    return children.map((folder) => {
      const hasChildren = (childrenOf.get(folder.id) ?? []).length > 0;
      const isExpanded = !collapsed.has(folder.id);
      return (
        <li key={folder.id}>
          <div
            className={cn(
              "flex items-center gap-1 rounded-md pr-2 text-sm",
              selected === folder.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
            )}
            style={{ paddingLeft: `${depth * 16 + 4}px` }}
          >
            <button
              onClick={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(folder.id)) next.delete(folder.id);
                  else next.add(folder.id);
                  return next;
                })
              }
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded text-muted-foreground",
                !hasChildren && "invisible"
              )}
              aria-label={isExpanded ? "Collapse" : "Expand"}
              tabIndex={hasChildren ? 0 : -1}
            >
              <ChevronRight
                className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")}
              />
            </button>
            <button
              onClick={() => setSelected(folder.id)}
              className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
            >
              <Folder className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{folder.name}</span>
            </button>
          </div>
          {hasChildren && isExpanded && <ul>{renderLevel(folder.id, depth + 1)}</ul>}
        </li>
      );
    });
  }

  const unchanged = selected === currentFolderId;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="truncate pr-6">Move “{file.name}”</DialogTitle>
        <DialogDescription>Choose where this file should live.</DialogDescription>
      </DialogHeader>

      {tree === null ? (
        <div className="space-y-2 py-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      ) : (
        <ul className="max-h-72 overflow-y-auto rounded-md border p-1.5">
          <li>
            <button
              onClick={() => setSelected(null)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                selected === null ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              )}
            >
              <FolderClosed className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{tree.roomName}</span>
              <span className="text-xs text-muted-foreground">(room root)</span>
            </button>
          </li>
          {renderLevel(null, 1)}
        </ul>
      )}

      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={move} disabled={pending || unchanged || tree === null}>
          {pending ? "Moving…" : "Move here"}
        </Button>
      </DialogFooter>
    </>
  );
}
