import Link from "next/link";
import { FileX2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareUnavailable() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="grid size-12 place-items-center rounded-lg bg-accent">
        <FileX2 className="size-5 text-accent-foreground" />
      </span>
      <h1 className="mt-5 font-serif text-2xl tracking-tight">
        This link is no longer available
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The owner may have revoked access, or the shared item was deleted. If you
        need it, ask whoever sent you the link to share it again.
      </p>
      <Button variant="outline" className="mt-6" asChild>
        <Link href="/">Go to Strongroom</Link>
      </Button>
    </div>
  );
}

export function ShareForbidden({ email }: { email: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="grid size-12 place-items-center rounded-lg bg-accent">
        <ShieldAlert className="size-5 text-accent-foreground" />
      </span>
      <h1 className="mt-5 font-serif text-2xl tracking-tight">
        This account doesn&apos;t have access
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        You&apos;re signed in as <span className="font-medium text-foreground">{email}</span>,
        but this share is restricted to specific people. Ask the owner to invite
        this email, or sign in with the account that was invited.
      </p>
      <Button variant="outline" className="mt-6" asChild>
        <Link href="/login">Switch account</Link>
      </Button>
    </div>
  );
}
