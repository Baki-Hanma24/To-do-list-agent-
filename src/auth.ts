import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getDb, schema } from "@/db";
import { encrypt } from "@/lib/crypto";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

function isAllowed(email: string | null | undefined): boolean {
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  return !!allowed && !!email && email.toLowerCase() === allowed;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: { scope: GOOGLE_SCOPES, access_type: "offline", prompt: "consent" },
      },
    }),
  ],
  pages: { signIn: "/signin" },
  callbacks: {
    async signIn({ user, account }) {
      if (!isAllowed(user.email)) return false;
      // Keep the refresh token (encrypted) so the approve route can act on Gmail/Calendar later.
      if (account?.refresh_token && user.email) {
        const db = await getDb();
        const row = {
          id: 1,
          email: user.email,
          refreshTokenEnc: encrypt(account.refresh_token),
          updatedAt: new Date(),
        };
        await db
          .insert(schema.googleTokens)
          .values(row)
          .onConflictDoUpdate({ target: schema.googleTokens.id, set: row });
      }
      return true;
    },
    authorized({ auth }) {
      return isAllowed(auth?.user?.email);
    },
  },
});
