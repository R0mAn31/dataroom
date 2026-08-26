import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { db } from "@/lib/db";
import { shareCoversFile } from "@/lib/access";
import { formatBytes, formatDate } from "@/lib/format";
import { loadShareContext } from "@/lib/share-view";
import { FilePreview } from "@/components/file-preview";
import { ShareShell } from "@/components/share/share-shell";
import { ShareForbidden, ShareUnavailable } from "@/components/share/share-status";
import { Button } from "@/components/ui/button";

export default async function ShareFilePage({
  params,
}: {
  params: Promise<{ token: string; fileId: string }>;
}) {
  const { token, fileId } = await params;
  const ctx = await loadShareContext(token);

  if (ctx.status === "signin") redirect(`/login?next=/share/${token}`);
  if (ctx.status === "unavailable") {
    return (
      <ShareShell viewerEmail={ctx.email}>
        <ShareUnavailable />
      </ShareShell>
    );
  }
  if (ctx.status === "forbidden") {
    return (
      <ShareShell viewerEmail={ctx.email}>
        <ShareForbidden email={ctx.email} />
      </ShareShell>
    );
  }

  const { resolved, user } = ctx;
  const file = await db.file.findUnique({ where: { id: fileId } });
  if (!file || !(await shareCoversFile(resolved, file))) {
    return (
      <ShareShell viewerEmail={user?.email}>
        <ShareUnavailable />
      </ShareShell>
    );
  }

  const isDirectFileShare = resolved.resource.type === "FILE";
  const backHref = file.folderId
    ? `/share/${token}/f/${file.folderId}`
    : `/share/${token}`;
  const contentSrc = `/api/files/${file.id}/content?share=${token}`;

  return (
    <ShareShell viewerEmail={user?.email}>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {!isDirectFileShare && (
              <Link
                href={backHref}
                className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                Back
              </Link>
            )}
            <h1 className="truncate font-serif text-lg tracking-tight">{file.name}</h1>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {formatBytes(file.size)} · updated {formatDate(file.updatedAt)} · shared
              by {resolved.ownerLabel}
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href={`${contentSrc}&download=1`}>
              <Download className="size-4" />
              Download
            </a>
          </Button>
        </div>

        <div className="mt-4 flex-1">
          <FilePreview name={file.name} mimeType={file.mimeType} src={contentSrc} />
        </div>
      </div>
    </ShareShell>
  );
}
