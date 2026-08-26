"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/auth/google-button";

export function LoginForm({
  googleEnabled,
  nextUrl,
}: {
  googleEnabled: boolean;
  nextUrl: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("That email and password don't match. Check them and try again.");
      setPending(false);
      return;
    }
    router.push(nextUrl);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-serif text-3xl tracking-tight">Sign in</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Open your data rooms and anything shared with you.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {googleEnabled && <GoogleButton nextUrl={nextUrl} />}

      <p className="mt-6 text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href={`/register?next=${encodeURIComponent(nextUrl)}`}
          className="text-foreground underline underline-offset-4 hover:text-primary"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
