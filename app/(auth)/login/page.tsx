import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, googleEnabled } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only allow same-app destinations.
  const nextUrl = next?.startsWith("/") && !next.startsWith("//") ? next : "/rooms";

  if (await currentUser()) redirect(nextUrl);

  return <LoginForm googleEnabled={googleEnabled} nextUrl={nextUrl} />;
}
