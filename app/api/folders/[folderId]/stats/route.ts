import { NextResponse } from "next/server";
import { handleApi, requireOwnedFolder, requireUser } from "@/lib/api-helpers";
import { folderStats } from "@/lib/access";

type Ctx = { params: Promise<{ folderId: string }> };

/** Subtree totals — shown in the "delete folder" warning. */
export const GET = handleApi(async (_request: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { folderId } = await params;
  const folder = await requireOwnedFolder(user.id, folderId);

  return NextResponse.json(await folderStats(folder));
});
