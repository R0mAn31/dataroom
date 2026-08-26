"use client";

import { Download } from "lucide-react";
import type { BrowserFile, BrowserFolder, Crumb } from "@/lib/types";
import { Breadcrumbs } from "@/components/browser/breadcrumbs";
import { ItemTable } from "@/components/browser/item-table";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

/** Read-only listing behind a share link. Navigation and downloads only. */
export function ShareBrowser({
  token,
  crumbs,
  folders,
  files,
  ownerLabel,
}: {
  token: string;
  crumbs: Crumb[];
  folders: BrowserFolder[];
  files: BrowserFile[];
  ownerLabel: string;
}) {
  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-6">
      <Breadcrumbs
        crumbs={crumbs}
        hrefFor={(crumb) =>
          crumb.id === null ? `/share/${token}` : `/share/${token}/f/${crumb.id}`
        }
      />
      <p className="mt-1 text-sm text-muted-foreground">Shared by {ownerLabel}</p>

      <div className="mt-5 flex-1">
        {isEmpty ? (
          <div className="grid min-h-64 place-items-center rounded-lg border border-dashed text-center">
            <div>
              <FolderOpen className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 font-medium">Nothing here yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The owner hasn&apos;t added any documents to this
                {crumbs.length > 1 ? " folder" : " share"}.
              </p>
            </div>
          </div>
        ) : (
          <ItemTable
            folders={folders}
            files={files}
            folderHref={(id) => `/share/${token}/f/${id}`}
            fileHref={(id) => `/share/${token}/file/${id}`}
            actions={{
              file: (file) => (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground transition-opacity focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  aria-label={`Download ${file.name}`}
                  asChild
                >
                  <a href={`/api/files/${file.id}/content?share=${token}&download=1`}>
                    <Download className="size-4" />
                  </a>
                </Button>
              ),
            }}
          />
        )}
      </div>
    </div>
  );
}
