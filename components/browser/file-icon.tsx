import {
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function FileIcon({
  mimeType,
  className,
}: {
  mimeType: string;
  className?: string;
}) {
  if (mimeType === "application/pdf") {
    return <FileText className={cn("text-rose-700/70", className)} />;
  }
  if (mimeType.startsWith("image/")) {
    return <FileImage className={cn("text-sky-700/70", className)} />;
  }
  if (mimeType.startsWith("video/")) {
    return <FileVideo className={cn("text-violet-700/70", className)} />;
  }
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("csv") ||
    mimeType.includes("excel")
  ) {
    return <FileSpreadsheet className={cn("text-emerald-700/70", className)} />;
  }
  return <File className={cn("text-muted-foreground", className)} />;
}
