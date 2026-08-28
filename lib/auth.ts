import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

const providers: NextAuthConfig["providers"] = [
  Credentials({
    credentials: { email: {}, password: {} },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;

      const user = await db.user.findUnique({ where: { email } });
      if (!user?.passwordHash) return null;

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;

      return { id: user.id, email: user.email, name: user.name };
    },
  }),
];

if (googleEnabled) {
  providers.push(
    Google({
      // Auth.js only auto-reads AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET; we document
      // GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET, so pass them explicitly.
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    // Invites can be created before the invitee has an account. On every
    // sign-in, attach any grants that were addressed to this email.
    async signIn({ user }) {
      if (!user.email || !user.id) return;
      await linkPendingGrants(user.id, user.email);
    },
  },
});

export async function linkPendingGrants(userId: string, email: string) {
  await db.shareGrant.updateMany({
    where: { email: email.toLowerCase(), userId: null },
    data: { userId },
  });
}

/** Session user for server components and route handlers, or null. */
export async function currentUser() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) return null;
  return { id: user.id, email: user.email.toLowerCase(), name: user.name ?? null };
}
