"use client";

import type { StorageMode } from "@/lib/storage";
import { api } from "@/lib/api-client";

export type UploadTarget = {
  roomId: string;
  folderId: string | null;
  mode: StorageMode;
};

export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

/**
 * Uploads one file and registers it as a data-room file (or a new version if
 * the name is taken). Local mode posts to our API; blob mode streams straight
 * from the browser to Vercel Blob so big files never hit a function limit.
 * Aborting `signal` at any point — mid-transfer or during the final register
 * call — surfaces as UploadCancelledError instead of a generic failure.
 */
export async function uploadFile(
  file: File,
  target: UploadTarget,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
): Promise<{ version: number }> {
  try {
    const storageKey =
      target.mode === "blob"
        ? await uploadToBlob(file, target, onProgress, signal)
        : await uploadToLocal(file, onProgress, signal);

    const { version } = await api<{ version: number }>("/api/files", {
      method: "POST",
      json: {
        roomId: target.roomId,
        folderId: target.folderId,
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        storageKey,
      },
      signal,
    });
    return { version };
  } catch (err) {
    // Both the XHR path and the abort-during-fetch path throw their own
    // shapes of error on cancel — normalize by checking the signal itself.
    if (signal?.aborted) throw new UploadCancelledError();
    throw err;
  }
}

async function uploadToBlob(
  file: File,
  target: UploadTarget,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  const { upload } = await import("@vercel/blob/client");
  const blob = await upload(file.name, file, {
    access: "private",
    handleUploadUrl: "/api/uploads/blob",
    clientPayload: JSON.stringify({ roomId: target.roomId }),
    onUploadProgress: ({ percentage }) => onProgress(percentage),
    abortSignal: signal,
  });
  return blob.url;
}

function uploadToLocal(
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads/local");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText).storageKey);
      } else {
        let message = "Upload failed. Try again.";
        try {
          message = JSON.parse(xhr.responseText).error ?? message;
        } catch {}
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    xhr.onabort = () => reject(new UploadCancelledError());

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
