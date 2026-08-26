"use client";

import type { StorageMode } from "@/lib/storage";
import { api } from "@/lib/api-client";

export type UploadTarget = {
  roomId: string;
  folderId: string | null;
  mode: StorageMode;
};

/**
 * Uploads one file and registers it as a data-room file (or a new version if
 * the name is taken). Local mode posts to our API; blob mode streams straight
 * from the browser to Vercel Blob so big files never hit a function limit.
 */
export async function uploadFile(
  file: File,
  target: UploadTarget,
  onProgress: (percent: number) => void
): Promise<{ version: number }> {
  const storageKey =
    target.mode === "blob"
      ? await uploadToBlob(file, target, onProgress)
      : await uploadToLocal(file, onProgress);

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
  });
  return { version };
}

async function uploadToBlob(
  file: File,
  target: UploadTarget,
  onProgress: (percent: number) => void
): Promise<string> {
  const { upload } = await import("@vercel/blob/client");
  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/uploads/blob",
    clientPayload: JSON.stringify({ roomId: target.roomId }),
    onUploadProgress: ({ percentage }) => onProgress(percentage),
  });
  return blob.url;
}

function uploadToLocal(
  file: File,
  onProgress: (percent: number) => void
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

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
