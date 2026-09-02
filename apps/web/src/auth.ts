import NextAuth from "next-auth";
import { cookies, headers } from "next/headers";
import { authConfig } from "@grc/auth";
import {
  credentialsProvider,
  logAccessEvent,
  buildAzureAdProvider,
  jitProvisionSsoUser,
} from "@grc/auth/providers";
import type { Provider } from "next-auth/providers";
import {
  userOrganizationRole,
  user as userTable,
  withUserReadContext,
} from "@grc/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { RoleAssignment } from "@grc/auth";
import { log } from "@/lib/logger";

const ORG_COOKIE = "arctos-org-id";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-085] Wie alt die JWT-Kopie der Rollen hoechstens
 * werden darf. Sie ist das, was die Edge-Middleware sieht; der Node-Pfad
 * (`withAuth`) liest ohnehin bei jedem Request frisch. Eine Minute ist der
 * Kompromiss zwischen „die Middleware entscheidet auf altem Stand" und „jeder
 * Request erzeugt eine zusaetzliche Abfrage".
 */
const ROLE_REFRESH_INTERVAL_MS = 60_000;

/**
 * #SEC-AUTH-BOOTSTRAP — the `session` callback runs on every `/api/auth/session`
 * read (served by NextAuth's own handler, NOT wrapped by `withAuth`), so NO
 * request-scoped RLS context exists. Under the non-superuser runtime role
 * `grc_app`, a context-less read of `user_organization_role` matches no policy
 * and silently returns 0 rows → `roles: []` → 400 no-org-selected everywhere.
 * Route through the shared self-read helper (reserves its own base-pool
 * connection + sets `app.current_user_id`) so a user always sees their OWN
 * roles. Under the dev/CI superuser this behaves like a plain read.
 */
/**
 * #WP3-S12-17 — `fetchFreshRoles` read ONLY `user_organization_role` and never
 * checked `user.isActive` / `user.deletedAt`; `withAuth` did not either, and
 * the credentials provider checks them only at login time. A deactivated or
 * deleted user therefore kept a fully functional session for the whole JWT
 * lifetime, and the JWT strategy has no denylist to revoke it with. The join
 * below turns every session refresh into a liveness check: when the user row is
 * gone or inactive, `disabled` is true and the session callback strips both the
 * roles and the org context, so `withAuth` can no longer authorise anything.
 */
/**
 * [ARCTOS-FULL-2026-08-31 · OP-085] `sessionsValidFrom` kommt aus derselben
 * Abfrage. Es ist die Sitzungs-Epoche aus Migration 0457: jedes JWT, dessen
 * `iat` davor liegt, gilt als beendet. Sie mitzulesen kostet keinen zweiten
 * Rundlauf — die `user`-Zeile wird fuer den Liveness-Check (S12-17) ohnehin
 * gejoint.
 */
export type FreshRoleResult = {
  roles: RoleAssignment[];
  disabled: boolean;
  sessionsValidFrom: Date | null;
};

async function fetchFreshRoles(userId: string): Promise<FreshRoleResult> {
  const rows = await withUserReadContext(userId, (rdb) =>
    rdb
      .select({
        orgId: userOrganizationRole.orgId,
        role: userOrganizationRole.role,
        lineOfDefense: userOrganizationRole.lineOfDefense,
        sessionsValidFrom: userTable.sessionsValidFrom,
      })
      .from(userOrganizationRole)
      .innerJoin(userTable, eq(userTable.id, userOrganizationRole.userId))
      .where(
        and(
          eq(userOrganizationRole.userId, userId),
          isNull(userOrganizationRole.deletedAt),
          eq(userTable.isActive, true),
          isNull(userTable.deletedAt),
        ),
      )
      // [E2E-TRIAGE-2026-09-02 · C-03b] The first triage added this ORDER BY to
      // `loadRoles()` (packages/auth/src/providers.ts:278) — but that query only
      // runs inside `authorize()` at sign-in. THIS one runs in the `session`
      // callback on every `/api/auth/session` read and REPLACES `token.roles`,
      // so it is the query that actually decides `roles[0].orgId`, i.e. the
      // ACTIVE ORGANISATION whenever no org cookie is set. Without an ORDER BY
      // it returned whatever order the heap happened to have.
      //
      // Measured against the running instance before this fix: the session of
      // the seeded admin (nine memberships) came back sorted by `org_id` and
      // landed in `E2E-F02b-…` — a throwaway organisation an earlier E2E run
      // had created. Every "loads with demo data" spec then asserted against an
      // empty tenant, and a real user with several memberships lands in a
      // different one depending on physical row order.
      //
      // Deliberately the same ordering as `loadRoles()`: sign-in and session
      // refresh must not disagree about which organisation is "home".
      .orderBy(
        asc(userOrganizationRole.createdAt),
        asc(userOrganizationRole.orgId),
      ),
  );

  if (rows.length > 0) {
    return {
      roles: rows.map(({ orgId, role, lineOfDefense }) => ({
        orgId,
        role,
        lineOfDefense,
      })) as RoleAssignment[],
      disabled: false,
      sessionsValidFrom: rows[0].sessionsValidFrom ?? null,
    };
  }

  // No rows means either "user has no role assignments" (legitimate) or
  // "user is deactivated/deleted" (session must die). Distinguish explicitly —
  // assuming the benign case is exactly what kept dead sessions alive.
  const live = await withUserReadContext(userId, (rdb) =>
    rdb
      .select({
        id: userTable.id,
        sessionsValidFrom: userTable.sessionsValidFrom,
      })
      .from(userTable)
      .where(
        and(
          eq(userTable.id, userId),
          eq(userTable.isActive, true),
          isNull(userTable.deletedAt),
        ),
      )
      .limit(1),
  );
  return {
    roles: [],
    disabled: live.length === 0,
    sessionsValidFrom: live[0]?.sessionsValidFrom ?? null,
  };
}

// Build the provider list — Azure AD is only included when env vars are set
const providers: Provider[] = [credentialsProvider];
const azureAdProvider = buildAzureAdProvider();
if (azureAdProvider) {
  providers.push(azureAdProvider);
}

/**
 * Read IP address and User-Agent from the current Next.js request headers.
 * Falls back gracefully if headers() is unavailable (e.g. edge cases).
 */
async function getRequestInfoFromHeaders(): Promise<{
  ipAddress: string | undefined;
  userAgent: string | undefined;
}> {
  try {
    const hdrs = await headers();
    const ipAddress =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      hdrs.get("x-real-ip") ||
      undefined;
    const userAgent = hdrs.get("user-agent") || undefined;
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: undefined, userAgent: undefined };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user: authUser, trigger }) {
      // Run the base JWT logic (sign-in persistence). Inline it here to avoid
      // type gymnastics with the loose NextAuth callback signatures.
      if (authUser) {
        token.userId = authUser.id!;
        token.email = authUser.email!;
        token.name = authUser.name!;
        (token as Record<string, unknown>).language =
          (authUser as { language?: string }).language ?? "de";
        (token as Record<string, unknown>).roles =
          (authUser as { roles?: RoleAssignment[] }).roles ?? [];
      }

      // On explicit session.update(), refresh roles from DB so newly created
      // orgs (and any role changes) are reflected without re-login.
      //
      // [ARCTOS-FULL-2026-08-31 · OP-085] Bis hierher war `trigger === "update"`
      // die EINZIGE Auffrischung der JWT-Kopie, also nur nach einem
      // ausdruecklichen `session.update()` im Client. Der Kommentar in
      // `packages/auth/src/config.ts` behauptete, der rollierende Refresh
      // (`updateAge`, 15 min) sorge dafuer, dass „die frisch gelesenen Rollen in
      // die JWT-Kopie wandern, die die Middleware sieht" — das stimmte nicht:
      // der rollierende Aufruf kommt OHNE Trigger hier an und lief in `return
      // token` hinein. Die Edge-Middleware (HinSchG-Gatter, Modulsicht)
      // entschied damit auf einer bis zu zwei Stunden alten Rollenliste.
      //
      // Jetzt wird bei JEDEM Durchlauf ohne frischen Anmeldevorgang
      // nachgeladen, aber hoechstens einmal pro `ROLE_REFRESH_INTERVAL_MS`.
      // Das Fenster begrenzt die Datenbanklast (der Callback laeuft pro
      // Request) und macht die JWT-Kopie hoechstens eine Minute alt statt zwei
      // Stunden. Der API-Verkehr war davon nie betroffen — `withAuth` liest
      // ueber den `session`-Callback ohnehin frisch (S12-17).
      const needsRefresh =
        !!token.userId &&
        (trigger === "update" ||
          Date.now() - ((token.rolesRefreshedAt as number) ?? 0) >
            ROLE_REFRESH_INTERVAL_MS);

      if (needsRefresh) {
        const fresh = await fetchFreshRoles(token.userId as string);
        (token as Record<string, unknown>).roles = fresh.roles;
        (token as Record<string, unknown>).disabled = fresh.disabled;
        (token as Record<string, unknown>).rolesRefreshedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      // Base fields from the token (matches config.ts shape).
      session.user.id = token.userId as string;
      session.user.email = token.email as string;
      session.user.name = token.name as string;
      // [ARCTOS-FULL-2026-08-31 / WP12 · S14-19] The whole block below used to
      // write the authorisation payload through `as any`. The token and
      // session shapes are declared in packages/auth/src/types.ts now, so a
      // rename in `RoleAssignment` breaks the build instead of silently
      // producing an empty role list at runtime.
      session.user.language = token.language ?? "de";

      // Roles: prefer fresh DB reads for the server-side session object so
      // newly granted roles are visible even if the JWT cookie still has a
      // stale list. The JWT-embedded copy is kept for the edge middleware.
      let roles: RoleAssignment[] = token.roles ?? [];
      let disabled = false;
      if (token.userId) {
        try {
          const fresh = await fetchFreshRoles(token.userId as string);
          roles = fresh.roles;
          disabled = fresh.disabled;

          // [ARCTOS-FULL-2026-08-31 · OP-085] Sitzungs-Invalidierung.
          //
          // Frische Rollen zu lesen genuegt fuer den Entzug EINER Rolle, aber
          // nicht fuer „dieser Zugang ist beendet": ein JWT bleibt bis zu zwei
          // Stunden eine gueltige Anmeldung, und die JWT-Strategie hat keinen
          // serverseitigen Sitzungsspeicher, in dem man eine einzelne Kennung
          // sperren koennte. Migration 0457 fuehrt deshalb eine Epoche je
          // Nutzer: wird eine Rolle vergeben oder entzogen, setzt die Route
          // `user.sessions_valid_from = now()`, und jedes AELTERE Token faellt
          // hier. `iat` steht im signierten Token, ist also nicht faelschbar.
          //
          // Die Wirkung ist bewusst dieselbe wie bei einem deaktivierten Konto
          // (S12-17): leere Rollen, kein Org-Kontext, `withAuth` verweigert ab
          // dem naechsten Request. Der Nutzer meldet sich neu an und bekommt
          // ein Token mit neuem `iat` und dem aktuellen Rechtestand.
          const issuedAt = typeof token.iat === "number" ? token.iat * 1000 : 0;
          if (
            fresh.sessionsValidFrom &&
            issuedAt < fresh.sessionsValidFrom.getTime()
          ) {
            disabled = true;
          }
        } catch (err) {
          // #DEP-CONFIG: structured log so the operator can grep
          // for `route:"auth.session"` + correlate with the user/org
          // when DB lookups fail (typical cause: pool exhaustion or
          // a transient pg connection error). Falling back to the
          // JWT-embedded role list is intentional — the JWT can't be
          // forged without AUTH_SECRET, and stale roles are better
          // than denying every session refresh during a brief blip.
          log.warn("auth: fresh role fetch failed, using JWT copy", {
            route: "auth.session",
            userId: token.userId as string,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      }
      // #WP3-S12-17: a deactivated/deleted user gets an EMPTY session — no
      // roles, no org — so every `withAuth` call fails closed on the very next
      // request instead of after up to 8 hours.
      session.user.roles = disabled ? [] : roles;
      session.user.disabled = disabled;
      if (disabled) {
        session.user.currentOrgId = null;
        return session;
      }

      // Resolve active org from the cookie, validated against roles.
      let currentOrgId: string | null = roles[0]?.orgId ?? null;
      try {
        const jar = await cookies();
        const fromCookie = jar.get(ORG_COOKIE)?.value;
        if (fromCookie && roles.some((r) => r.orgId === fromCookie)) {
          currentOrgId = fromCookie;
        }
      } catch {
        // cookies() can throw in some edge contexts — keep fallback
      }
      session.user.currentOrgId = currentOrgId;

      return session;
    },
    async signIn({ user: authUser, account, profile }) {
      // For SSO providers, run JIT provisioning to ensure a DB user exists
      if (account?.provider === "microsoft-entra-id" && profile?.email) {
        try {
          const { ipAddress, userAgent } = await getRequestInfoFromHeaders();
          const provisioned = await jitProvisionSsoUser({
            email: (profile.email as string).toLowerCase(),
            name: (profile.name as string) ?? (profile.email as string),
            ssoProviderId: `entra:${profile.sub ?? profile.oid}`,
            ipAddress,
            userAgent,
          });

          // Attach provisioned data to the user object so the JWT callback picks it up
          authUser.id = provisioned.id;
          authUser.email = provisioned.email;
          authUser.name = provisioned.name;
          authUser.language = provisioned.language;
          authUser.roles = provisioned.roles;
        } catch (err) {
          // #DEP-CONFIG: structured log lets the operator see WHY
          // SSO provisioning fell over (DB schema drift, duplicate
          // email collision, etc.) without scraping container
          // stderr. Includes the IDP-supplied email + sub for
          // correlation — both are already in the access_event log
          // table on the success path; logging them here too keeps
          // the failure path queryable.
          log.error("sso: JIT provisioning failed", {
            route: "auth.signIn",
            provider: account?.provider,
            emailAttempted: (profile?.email as string)?.toLowerCase(),
            sub: profile?.sub ?? profile?.oid,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
          return false; // Deny sign-in on provisioning failure
        }
      }
      return true;
    },
  },
  events: {
    async signOut(message) {
      // Log logout event to access_log with IP/UA when available
      const token = "token" in message ? message.token : null;
      if (token?.email) {
        const { ipAddress, userAgent } = await getRequestInfoFromHeaders();
        await logAccessEvent({
          userId: token.userId as string | undefined,
          emailAttempted: token.email as string,
          eventType: "logout",
          ipAddress,
          userAgent,
        });
      }
    },
  },
});
