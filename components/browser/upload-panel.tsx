"use client";

import { AlertCircle, CheckCircle2, RotateCcw, X } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export type UploadTask = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "done" | "error" | "cancelled";
  /** Set when the upload became version 2+ of an existing file. */
  version?: number;
  error?: string;
};

export function UploadPanel({
  tasks,
  onClear,
  onCancel,
  onRetry,
}: {
  tasks: UploadTask[];
  onClear: () => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  if (tasks.length === 0) return null;

  const active = tasks.filter((t) => t.status === "uploading").length;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-card shadow-lg">
      <div className="flex items-center justify-between border-b px-3.5 py-2.5">
        <p className="text-sm font-medium">
          {active > 0
            ? `Uploading ${active} ${active === 1 ? "file" : "files"}…`
            : "Uploads finished"}
        </p>
        {active === 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onClear}
            aria-label="Close upload panel"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
      <ul className="max-h-64 overflow-y-auto p-2">
        {tasks.map((task) => (
          <li key={task.id} className="group rounded-md px-1.5 py-1.5">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm">{task.name}</span>
              {task.status === "done" &&
                (task.version && task.version > 1 ? (
                  <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 font-mono text-[11px] text-accent-foreground">
                    v{task.version}
                  </span>
                ) : (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                ))}
              {task.status === "error" && (
                <>
                  <AlertCircle className="size-4 shrink-0 text-destructive" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-muted-foreground"
                    onClick={() => onRetry(task.id)}
                    aria-label={`Retry uploading ${task.name}`}
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                </>
              )}
              {task.status === "cancelled" && (
                <>
                  <span className="shrink-0 text-xs text-muted-foreground">Cancelled</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-muted-foreground"
                    onClick={() => onRetry(task.id)}
                    aria-label={`Retry uploading ${task.name}`}
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                </>
              )}
              {task.status === "uploading" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => onCancel(task.id)}
                  aria-label={`Cancel uploading ${task.name}`}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
            {task.status === "uploading" && (
              <div className="mt-1.5 flex items-center gap-2">
                <Progress value={task.progress} className="h-1" />
                <span className="w-16 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                  {formatBytes(task.size)}
                </span>
              </div>
            )}
            {task.status === "error" && (
              <p className="mt-0.5 text-xs text-destructive">{task.error}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
