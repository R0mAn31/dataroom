import Link from "next/link";
import { Eye } from "lucide-react";
import { Brand } from "@/components/brand";

/** Chrome for everything under /share — deliberately quieter than the app. */
export function ShareShell({
  viewerEmail,
  children,
}: {
  viewerEmail?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="flex items-center justify-between border-b bg-sidebar px-5 py-3">
        <Brand href="/" />
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
            <Eye className="size-3" />
            View only
          </span>
          {viewerEmail ? (
            <span className="hidden text-xs text-muted-foreground sm:block">
              {viewerEmail}
            </span>
          ) : (
            <Link
              href="/login"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
