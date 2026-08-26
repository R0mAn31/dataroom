import { redirect } from "next/navigation";
import { listChildren } from "@/lib/queries";
import { loadShareContext } from "@/lib/share-view";
import { ShareBrowser } from "@/components/share/share-browser";
import { ShareShell } from "@/components/share/share-shell";
import { ShareForbidden, ShareUnavailable } from "@/components/share/share-status";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
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
  if (resolved.resource.type === "FILE") {
    redirect(`/share/${token}/file/${resolved.resource.file.id}`);
  }

  const rootFolderId =
    resolved.resource.type === "FOLDER" ? resolved.resource.folder.id : null;
  const rootName =
    resolved.resource.type === "FOLDER"
      ? resolved.resource.folder.name
      : resolved.roomName;

  const { folders, files } = await listChildren(resolved.share.roomId, rootFolderId);

  return (
    <ShareShell viewerEmail={user?.email}>
      <ShareBrowser
        token={token}
        crumbs={[{ id: null, name: rootName }]}
        folders={folders}
        files={files}
        ownerLabel={resolved.ownerLabel}
      />
    </ShareShell>
  );
}
