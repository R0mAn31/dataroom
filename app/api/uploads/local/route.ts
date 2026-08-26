import { NextResponse } from "next/server";
import { ApiError, handleApi, requireUser } from "@/lib/api-helpers";
import { saveLocalFile, storageMode } from "@/lib/storage";

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Dev-only upload target used when no Blob token is configured. In
 * production, browsers upload directly to Vercel Blob (see ../blob).
 */
export const POST = handleApi(async (request: Request) => {
  await requireUser();
  if (storageMode() !== "local") {
    throw new ApiError(400, "Direct uploads are disabled when Blob storage is configured.");
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "No file in the request.");
  if (file.size > MAX_SIZE) {
    throw new ApiError(413, "Files larger than 100 MB aren't supported.");
  }

  const storageKey = await saveLocalFile(await file.arrayBuffer());
  return NextResponse.json({ storageKey }, { status: 201 });
});
