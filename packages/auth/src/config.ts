// Auth.js BASE configuration — edge-safe (no DB imports)
// This is used by both the full auth.ts (Node.js) and middleware (Edge Runtime).
// Providers that need DB access are added in the app's auth.ts.

import type { NextAuthConfig } from "next-auth";
import type { RoleAssignment } from "./types";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8h

  pages: {
    signIn: "/login",
  },

  providers: [], // populated in apps/web/src/auth.ts

  callbacks: {
    async jwt({ token, user: authUser }) {
      // On initial sign-in, persist user data into the JWT
      if (authUser) {
        token.userId = authUser.id!;
        token.email = authUser.email!;
        token.name = authUser.name!;
        token.language = (authUser as any).language ?? "de";
        token.roles = (authUser as any).roles ?? [];
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.email = token.email as string;
      session.user.name = token.name as string;
      (session.user as any).language = (token as any).language ?? "de";
      (session.user as any).roles =
        ((token as any).roles as RoleAssignment[]) ?? [];
      return session;
    },
  },
};
