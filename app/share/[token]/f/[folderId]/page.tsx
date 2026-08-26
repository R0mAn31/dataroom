import { redirect } from "next/navigation";
import { shareCoversFolder } from "@/lib/access";
import { breadcrumbTrail, listChildren } from "@/lib/queries";
import { loadShareContext } from "@/lib/share-view";
import { ShareBrowser } from "@/components/share/share-browser";
import { ShareShell } from "@/components/share/share-shell";
import { ShareForbidden, ShareUnavailable } from "@/components/share/share-status";

export default async function ShareFolderPage({
  params,
}: {
  params: Promise<{ token: string; folderId: string }>;
}) {
  const { token, folderId } = await params;
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
  const folder = await shareCoversFolder(resolved, folderId);
  if (!folder) {
    // Outside the shared subtree, or deleted while someone was browsing.
    return (
      <ShareShell viewerEmail={user?.email}>
        <ShareUnavailable />
      </ShareShell>
    );
  }

  // Breadcrumbs start at the share root — nothing above it is revealed.
  const fullTrail = await breadcrumbTrail(resolved.roomName, folder);
  let crumbs = fullTrail;
  if (resolved.resource.type === "FOLDER") {
    const rootId = resolved.resource.folder.id;
    crumbs = fullTrail.slice(fullTrail.findIndex((c) => c.id === rootId));
  }
  crumbs = crumbs.map((c, i) => (i === 0 ? { ...c, id: null } : c));

  const { folders, files } = await listChildren(resolved.share.roomId, folder.id);

  return (
    <ShareShell viewerEmail={user?.email}>
      <ShareBrowser
        token={token}
        crumbs={crumbs}
        folders={folders}
        files={files}
        ownerLabel={resolved.ownerLabel}
      />
    </ShareShell>
  );
}
