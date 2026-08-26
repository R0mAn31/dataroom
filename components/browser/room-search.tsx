"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Folder, Search } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { SearchResults } from "@/lib/types";
import { FileIcon } from "@/components/browser/file-icon";
import { Input } from "@/components/ui/input";

/** Name search across the whole room, wherever you're standing in it. */
export function RoomSearch({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setQuery(next);
    if (next.trim().length < 2) {
      setResults(null);
      setOpen(false);
    }
  }

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/rooms/${roomId}/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        setResults(await res.json());
        setOpen(true);
      } catch {
        // aborted or offline — keep the previous state
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, roomId]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const isEmpty =
    results !== null && results.files.length === 0 && results.folders.length === 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={handleChange}
        onFocus={() => results && setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="Search this room"
        className="pl-8"
        aria-label="Search files and folders in this room"
      />

      {open && results && (
        <div className="absolute top-full z-40 mt-1.5 w-full min-w-72 overflow-hidden rounded-md border bg-popover shadow-md">
          {isEmpty ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Nothing in this room matches “{query.trim()}”.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.folders.map((folder) => (
                <li key={folder.id}>
                  <button
                    onClick={() => go(`/rooms/${roomId}/f/${folder.id}`)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {folder.location}
                    </span>
                  </button>
                </li>
              ))}
              {results.files.map((file) => (
                <li key={file.id}>
                  <button
                    onClick={() => go(`/rooms/${roomId}/file/${file.id}`)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <FileIcon mimeType={file.mimeType} className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
