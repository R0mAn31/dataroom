import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextUrl = next?.startsWith("/") && !next.startsWith("//") ? next : "/rooms";

  if (await currentUser()) redirect(nextUrl);

  return <RegisterForm nextUrl={nextUrl} />;
}
