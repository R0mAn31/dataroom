import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { handleApi, jsonError } from "@/lib/api-helpers";
import { canReadFile } from "@/lib/access";
import { readStoredFile } from "@/lib/storage";

type Ctx = { params: Promise<{ fileId: string }> };

/**
 * Streams file bytes through the app so access control applies to every
 * download, whichever storage backend holds the object.
 * ?share=<token>  — grants access through a share link
 * ?version=<n>    — a specific version (latest by default)
 * ?download=1     — Content-Disposition: attachment
 */
export const GET = handleApi(async (request: Request, { params }: Ctx) => {
  const { fileId } = await params;
  const url = new URL(request.url);
  const user = await currentUser();
  const shareToken = url.searchParams.get("share");

  if (!(await canReadFile(fileId, { user, shareToken }))) {
    return jsonError(404, "File not found or you don't have access.");
  }

  const file = await db.file.findUnique({
    where: { id: fileId },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!file) return jsonError(404, "File not found or you don't have access.");

  const versionParam = url.searchParams.get("version");
  const version = versionParam
    ? file.versions.find((v) => v.version === Number(versionParam))
    : file.versions[0];
  if (!version) return jsonError(404, "This version no longer exists.");

  const stored = await readStoredFile(version.storageKey);
  if (!stored) return jsonError(404, "The file contents could not be read.");

  const disposition = url.searchParams.get("download") ? "attachment" : "inline";
  return new Response(stored.stream, {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      ...(stored.size ? { "Content-Length": String(stored.size) } : {}),
      "Cache-Control": "private, no-store",
    },
  });
});
