"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { FolderClosed, LogOut, Menu, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { SidebarNav } from "@/components/sidebar-nav";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type ShellUser = { id: string; email: string; name: string | null };

export const NAV_ITEMS = [
  { href: "/rooms", label: "Data rooms", icon: FolderClosed },
  { href: "/shared", label: "Shared with me", icon: Users },
];

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar">
        <div className="px-5 pt-5 pb-4">
          <Brand />
        </div>
        <SidebarNav items={NAV_ITEMS} />
        <div className="mt-auto border-t p-3">
          <UserMenu user={user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b bg-sidebar px-4 py-3 md:hidden">
          <Brand />
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="px-5 pt-5 pb-4">
                <Brand />
              </div>
              <SidebarNav items={NAV_ITEMS} onNavigate={() => setMobileNavOpen(false)} />
              <div className="mt-auto border-t p-3">
                <UserMenu user={user} />
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex flex-1 flex-col min-w-0">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const initials = (user.name ?? user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-md p-2 text-left hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {user.name ?? user.email}
            </span>
            {user.name && (
              <span className="block truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            )}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
