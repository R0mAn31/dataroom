"use client";

import { Download, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Inline preview for PDFs and images; everything else offers a download. */
export function FilePreview({
  name,
  mimeType,
  src,
}: {
  name: string;
  mimeType: string;
  src: string;
}) {
  if (mimeType === "application/pdf") {
    return (
      <iframe
        src={src}
        title={name}
        className="h-[75vh] min-h-96 w-full rounded-lg border bg-white"
      />
    );
  }

  if (mimeType.startsWith("image/")) {
    return (
      <div className="grid place-items-center rounded-lg border bg-muted/40 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- blob/API-served, size unknown at build time */}
        <img src={src} alt={name} className="max-h-[75vh] max-w-full rounded" />
      </div>
    );
  }

  return (
    <div className="grid min-h-64 place-items-center rounded-lg border border-dashed">
      <div className="text-center">
        <FileQuestion className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 font-medium">No preview for this file type</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Download it to view the contents.
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <a href={`${src}${src.includes("?") ? "&" : "?"}download=1`}>
            <Download className="size-4" />
            Download
          </a>
        </Button>
      </div>
    </div>
  );
}
