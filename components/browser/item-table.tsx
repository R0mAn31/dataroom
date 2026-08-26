"use client";

import Link from "next/link";
import { Folder } from "lucide-react";
import { formatBytes, formatDate } from "@/lib/format";
import type { BrowserFile, BrowserFolder } from "@/lib/types";
import { FileIcon } from "@/components/browser/file-icon";

export type ItemActions = {
  folder?: (folder: BrowserFolder) => React.ReactNode;
  file?: (file: BrowserFile) => React.ReactNode;
};

/**
 * The ledger: folders first, then files, hairline rows, mono figures.
 * Used by both the owner's browser and the read-only share view — the
 * `actions` slots are what differ.
 */
export function ItemTable({
  folders,
  files,
  folderHref,
  fileHref,
  actions,
}: {
  folders: BrowserFolder[];
  files: BrowserFile[];
  folderHref: (id: string) => string;
  fileHref: (id: string) => string;
  actions?: ItemActions;
}) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="border-b py-2 pl-2 pr-3 font-medium">Name</th>
          <th className="w-24 border-b px-3 py-2 text-right font-medium">Size</th>
          <th className="hidden w-32 border-b px-3 py-2 font-medium sm:table-cell">
            Modified
          </th>
          {actions && <th className="w-11 border-b" aria-label="Actions" />}
        </tr>
      </thead>
      <tbody>
        {folders.map((folder) => (
          <tr key={folder.id} className="group hover:bg-muted/60">
            <td className="border-b py-0 pl-2 pr-3">
              <Link
                href={folderHref(folder.id)}
                className="flex items-center gap-2.5 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                <Folder className="size-4 shrink-0 fill-muted-foreground/15 text-muted-foreground" />
                <span className="truncate font-medium">{folder.name}</span>
              </Link>
            </td>
            <td className="border-b px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
              —
            </td>
            <td className="hidden border-b px-3 py-2.5 font-mono text-xs text-muted-foreground sm:table-cell">
              {formatDate(folder.updatedAt)}
            </td>
            {actions && (
              <td className="border-b py-1 pr-1 text-right">
                {actions.folder?.(folder)}
              </td>
            )}
          </tr>
        ))}
        {files.map((file) => (
          <tr key={file.id} className="group hover:bg-muted/60">
            <td className="border-b py-0 pl-2 pr-3">
              <Link
                href={fileHref(file.id)}
                className="flex items-center gap-2.5 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                <FileIcon mimeType={file.mimeType} className="size-4 shrink-0" />
                <span className="truncate">{file.name}</span>
                {file.versions > 1 && (
                  <span
                    className="shrink-0 rounded bg-accent px-1.5 py-px font-mono text-[11px] text-accent-foreground"
                    title={`${file.versions} versions`}
                  >
                    v{file.versions}
                  </span>
                )}
              </Link>
            </td>
            <td className="border-b px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
              {formatBytes(file.size)}
            </td>
            <td className="hidden border-b px-3 py-2.5 font-mono text-xs text-muted-foreground sm:table-cell">
              {formatDate(file.updatedAt)}
            </td>
            {actions && (
              <td className="border-b py-1 pr-1 text-right">{actions.file?.(file)}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
