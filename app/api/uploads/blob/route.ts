import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { ApiError, handleApi, requireOwnedRoom, requireUser } from "@/lib/api-helpers";

const payloadSchema = z.object({ roomId: z.string() });

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Token exchange for direct browser→Blob uploads. The browser never gets a
 * token unless the signed-in user owns the room it is uploading into.
 */
export const POST = handleApi(async (request: Request) => {
  const body = (await request.json()) as HandleUploadBody;

  const result = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (_pathname, clientPayload) => {
      const user = await requireUser();
      const parsed = payloadSchema.safeParse(JSON.parse(clientPayload ?? "{}"));
      if (!parsed.success) throw new ApiError(400, "Invalid upload request.");
      await requireOwnedRoom(user.id, parsed.data.roomId);

      return {
        maximumSizeInBytes: MAX_SIZE,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ userId: user.id }),
      };
    },
    // The client registers the file itself after the upload finishes, so the
    // completion webhook has nothing to do (and doesn't fire on localhost).
    onUploadCompleted: async () => {},
  });

  return NextResponse.json(result);
});
