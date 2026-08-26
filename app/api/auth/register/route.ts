import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { linkPendingGrants } from "@/lib/auth";
import { handleApi, jsonError } from "@/lib/api-helpers";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password needs at least 8 characters.").max(200),
});

export const POST = handleApi(async (request: Request) => {
  const { name, email, password } = registerSchema.parse(await request.json());
  const normalizedEmail = email.toLowerCase();

  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return jsonError(409, "An account with this email already exists. Sign in instead.");
  }

  const user = await db.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  await linkPendingGrants(user.id, normalizedEmail);

  return NextResponse.json({ id: user.id }, { status: 201 });
});
