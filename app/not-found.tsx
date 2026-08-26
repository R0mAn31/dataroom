import Link from "next/link";
import { Compass } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="p-6">
        <Brand href="/" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <span className="grid size-12 place-items-center rounded-lg bg-accent">
          <Compass className="size-5 text-accent-foreground" />
        </span>
        <h1 className="mt-5 font-serif text-2xl tracking-tight">
          This page doesn&apos;t exist
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The item may have been deleted, or the address was mistyped.
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href="/rooms">Back to your data rooms</Link>
        </Button>
      </main>
    </div>
  );
}
