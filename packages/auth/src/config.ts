// Auth.js BASE configuration — edge-safe (no DB imports)
// This is used by both the full auth.ts (Node.js) and middleware (Edge Runtime).
// Providers that need DB access are added in the app's auth.ts.

import type { NextAuthConfig } from "next-auth";
import { cookies } from "next/headers";
import type { RoleAssignment } from "./types";

const ORG_COOKIE = "arctos-org-id";

export const authConfig: NextAuthConfig = {
  // #WP3-S02-16 / S12-17 — session lifetime.
  //
  // Was: `{ strategy: "jwt", maxAge: 8 * 60 * 60 }` — a fixed 8-hour window
  // with no idle timeout, no rotation and no server-side revocation. A stolen
  // cookie stayed valid for up to 8 hours, and the edge middleware (which reads
  // ONLY the JWT copy of the roles) evaluated the HinSchG isolation gate
  // against a role list that could be 8 hours stale (S12-17).
  //
  // Now: a 2-hour ABSOLUTE lifetime, rolled forward whenever an active session
  // is refreshed (`updateAge` = 15 min). An idle session dies after 2 hours; an
  // active one keeps working.
  //
  // [ARCTOS-FULL-2026-08-31 · OP-085] Hier stand weiter: "`updateAge` also
  // re-issues the token regularly, which is what makes the freshly read roles
  // in `apps/web/src/auth.ts` propagate into the JWT copy the middleware sees."
  // Das war falsch. Der rollierende Refresh ruft den `jwt`-Callback OHNE
  // `trigger` auf, und der Callback lud die Rollen ausschliesslich bei
  // `trigger === "update"` nach — also nur nach einem ausdruecklichen
  // `session.update()` im Client. Die JWT-Kopie blieb bis zum Ablauf der
  // Sitzung auf dem Stand der Anmeldung, und die Edge-Middleware entschied ihr
  // HinSchG-Gatter darauf. Der Kommentar beschrieb ein Verhalten, das der Code
  // nicht hatte — in einem GRC-Produkt der schwerere Mangel, weil ein Pruefer
  // sich darauf verlaesst.
  //
  // Behoben in `apps/web/src/auth.ts`: der `jwt`-Callback frischt jetzt
  // zeitgesteuert nach (`ROLE_REFRESH_INTERVAL_MS`, 60 s).
  //
  // Und die JWT-Strategie kann eine ausgestellte Sitzung jetzt DOCH beenden:
  // `user.sessions_valid_from` (Migration 0457) ist eine Epoche je Nutzer;
  // jedes Token mit aelterem `iat` wird im `session`-Callback abgelehnt. Die
  // uebrigen Kontrollen bleiben: der `isActive`/`deletedAt`-Check bei jedem
  // authentifizierten Request und die Node-Spiegelung des HinSchG-Gatters in
  // `withAuth`.
  session: {
    strategy: "jwt",
    maxAge: 2 * 60 * 60, // 2h absolute
    updateAge: 15 * 60, // rolling refresh while active
  },

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
        // [ARCTOS-FULL-2026-08-31 / WP12 · S14-19] `as any` removed — the
        // token shape is declared in ./types.ts.
        token.language = authUser.language ?? "de";
        token.roles = authUser.roles ?? [];
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.email = token.email as string;
      session.user.name = token.name as string;
      // [WP12 · S14-19] Typed via the augmentation in ./types.ts.
      session.user.language = token.language ?? "de";
      const roles: RoleAssignment[] = token.roles ?? [];
      session.user.roles = roles;
      session.user.disabled = token.disabled ?? false;

      // Resolve the active org from the cookie, validated against the user's
      // roles. Without this, client components (layout, switcher) would have
      // to guess or always show the first role — which is the bug behind
      // Finding F-05: switch-org updates the cookie but the UI never picks it up.
      let currentOrgId: string | null = roles[0]?.orgId ?? null;
      try {
        const jar = await cookies();
        const fromCookie = jar.get(ORG_COOKIE)?.value;
        if (fromCookie && roles.some((r) => r.orgId === fromCookie)) {
          currentOrgId = fromCookie;
        }
      } catch {
        // cookies() can throw in some edge contexts — fall back to first role
      }
      session.user.currentOrgId = currentOrgId;

      return session;
    },
  },
};
