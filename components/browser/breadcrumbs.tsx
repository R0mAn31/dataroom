"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Crumb } from "@/lib/types";

export function Breadcrumbs({
  crumbs,
  hrefFor,
}: {
  crumbs: Crumb[];
  hrefFor: (crumb: Crumb) => string;
}) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 overflow-x-auto whitespace-nowrap text-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.id ?? "root"} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
              )}
              {isLast ? (
                <span
                  aria-current="page"
                  className="truncate font-serif text-lg tracking-tight"
                >
                  {crumb.name}
                </span>
              ) : (
                <Link
                  href={hrefFor(crumb)}
                  className="max-w-40 truncate rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
