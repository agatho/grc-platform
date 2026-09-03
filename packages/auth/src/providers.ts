// ════════════════════════════════════════════════════════════════════
// #OP-081 — Server-Guard: dieses Modul gehoert nicht in ein Client-Bundle
// ════════════════════════════════════════════════════════════════════
//
// Befund. Diese Datei traegt den Anmeldepfad: Passwortvergleich (bcrypt),
// den Konto-Lockout ueber SECURITY-DEFINER-Funktionen, die Rollenaufloesung
// und die Entra-ID-Zugangsdaten aus `AUTH_MICROSOFT_ENTRA_ID_*`. Der
// Kopfkommentar sagte bisher nur "Node.js only" — als Satz, nicht als
// Zusicherung. Ein Import aus einer `"use client"`-Datei war ein stiller
// Shim, kein Fehler.
//
// Mittel und Bauart siehe packages/db/src/index.ts (derselbe Guard, dort
// mit der vollstaendigen Messung). Kurz: `import()` statt `import`, weil
// das npm-Paket `server-only` seinen Wurf ueber die `default`-Condition
// ausliefert und Node — anders als Next.js — die Condition `react-server`
// nicht setzt. Ein statisches `import "server-only"` machte am 2026-09-03
// vier Suiten in packages/auth rot (u. a. providers.test.ts,
// login-lockout.test.ts, scim.test.ts) und haette zusaetzlich
// packages/db/tests/rls/auth-session-refresh-rls.test.ts getroffen, das
// `loadRoles` aus diesem Modul zieht.
void import("server-only").catch(() => {
  // Erwartet unter Node; die Wirkung dieses Guards liegt im Bundler.
});

// Auth providers — Node.js only (requires DB access)
// These are imported in apps/web/src/auth.ts, NOT in middleware.

import Credentials from "next-auth/providers/credentials";
import { timingSafeEqual } from "crypto";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { compare } from "bcryptjs";
import { eq, and, asc, isNull, sql, inArray } from "drizzle-orm";
import { db, withUserReadContext } from "@grc/db";
import { userOrganizationRole, accessLog, ssoConfig } from "@grc/db";
import type { RoleAssignment } from "./types";
import type { Provider } from "next-auth/providers";

/**
 * Pure attribution rule (F-03): a login is attributable to an org only when
 * the user is a member of exactly ONE org. Zero orgs (unknown / not yet
 * provisioned) or multiple orgs → org-less (null). Exported for unit testing.
 */
export function pickAttributableOrgId(
  orgIds: readonly (string | null | undefined)[],
): string | null {
  const distinct = [...new Set(orgIds.filter((o): o is string => !!o))];
  return distinct.length === 1 ? distinct[0] : null;
}

// ════════════════════════════════════════════════════════════════════
// #WP3-S02-09 (Medium) — Login-Lockout und Timing-Angleichung
// ════════════════════════════════════════════════════════════════════
//
// Befund: der reguläre Login über `/api/auth/callback/credentials` enthielt
// KEINERLEI Drosselung — kein Zähler, keine Sperre, keine Verzögerung
// (`grep -rn "lockout|failed_attempts|locked_until"` über packages/auth und
// packages/db/src/schema → keine Treffer). Die Rate-Limit-Bibliothek war in 5
// von 1.357 Routendateien verwendet, und ihre einzige auth-bezogene Nutzung
// (`admin-login`) war wegen S02-04 gar nicht erreichbar. Zielkennung und
// Passwort waren aus dem öffentlichen Repository bekannt (S02-01).
//
// Umsetzung hier: ein Konto-basierter Lockout — Zähler und Sperre in der
// `user`-Tabelle (Migration 0411), gepflegt über SECURITY-DEFINER-Funktionen
// (Migration 0412), weil der Login ohne Org-Kontext läuft und `user` FORCE-RLS
// hat. Konto-basiert statt IP-basiert, weil die IP aus `X-Forwarded-For`
// stammt und vom Client frei wählbar ist — genau die Umgehung, die der Befund
// beschreibt.
//
// ABGRENZUNG: `apps/web/src/lib/rate-limit.ts` gehört WP9. Der dortige
// `getClientIp()` nimmt weiterhin ungeprüft den ERSTEN X-Forwarded-For-Wert
// und der Limiter ist fail-open und prozesslokal. Der Bedarf ist in
// /work/audit/remediation/WP3.md an WP9 übergeben; dieser Fix ist bewusst
// unabhängig davon wirksam.

export const LOGIN_MAX_FAILED_ATTEMPTS = 10;
export const LOGIN_LOCKOUT_MINUTES = 15;

/** A bcrypt hash of a random value — used to equalise response timing. */
const DUMMY_BCRYPT_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEeO3Y8Y0gWJ5x1r8YtQm8k9r0hI9Zr2wOa";

export interface LoginLockState {
  locked: boolean;
  lockedUntil: Date | null;
}

/** Is this account currently locked out? */
export async function checkLoginLock(email: string): Promise<LoginLockState> {
  try {
    const rows = (await db.execute(
      sql`SELECT * FROM public.auth_check_login_lock(${email})`,
    )) as unknown as Array<Record<string, unknown>>;
    const list = Array.isArray(rows)
      ? rows
      : ((rows as { rows?: Array<Record<string, unknown>> }).rows ?? []);
    const row = list[0];
    if (!row) return { locked: false, lockedUntil: null };
    return {
      locked: row.out_locked === true,
      lockedUntil: row.out_locked_until
        ? new Date(row.out_locked_until as string)
        : null,
    };
  } catch (err) {
    // Fail CLOSED would lock everyone out on a transient DB error, fail OPEN
    // would silently disable the control. Log loudly and allow — the password
    // check itself still has to succeed, and the counter below records the
    // attempt as soon as the DB is back.
    console.error(
      "[auth] login lock check failed:",
      err instanceof Error ? err.message : err,
    );
    return { locked: false, lockedUntil: null };
  }
}

/** Count a failed attempt; locks the account when the threshold is reached. */
export async function registerLoginFailure(email: string): Promise<void> {
  try {
    await db.execute(
      sql`SELECT * FROM public.auth_register_login_failure(${email}, ${LOGIN_MAX_FAILED_ATTEMPTS}, ${LOGIN_LOCKOUT_MINUTES})`,
    );
  } catch (err) {
    console.error(
      "[auth] failed-login counter update failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Reset the counter after a successful authentication. */
export async function registerLoginSuccess(userId: string): Promise<void> {
  try {
    await db.execute(
      sql`SELECT public.auth_register_login_success(${userId}::uuid)`,
    );
  } catch (err) {
    console.error(
      "[auth] login success bookkeeping failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * #WP3-S02-17 — user enumeration through response time.
 *
 * On an unknown address the old code returned BEFORE any bcrypt work, while a
 * known address paid for a 10–12 round comparison. The difference is tens of
 * milliseconds — measurable over the network, and with no rate limit (S02-09)
 * repeatable arbitrarily often. Burn the same work on the miss path.
 */
async function equaliseTiming(password: string): Promise<void> {
  try {
    await compare(password, DUMMY_BCRYPT_HASH);
  } catch {
    // Ignore — this call exists only for its cost.
  }
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-083] Anmeldeabfrage auf `user` per E-Mail.
 *
 * Diese Abfrage lief als `db.select().from(user)` ueber den Basis-Pool, also
 * OHNE Request-Kontext — sie muss das, weil die Identitaet erst aus ihr folgt.
 * Damit sie unter `grc_app` ueberhaupt etwas zurueckgab, trug die `user`-Policy
 * aus 0392 eine dritte Disjunktion: "oder die Verbindung traegt gar keinen
 * Kontext". Der Preis war das gesamte Nutzerverzeichnis ALLER Mandanten auf
 * jeder kontextlosen Verbindung — gemessen 36 Zeilen mit Passwort-Hashes
 * gegenueber 1 Zeile mit gesetztem Org-Kontext.
 *
 * Jetzt ueber `auth_lookup_user_by_email` (Migration 0455, SECURITY DEFINER,
 * fixierter search_path, EXECUTE nur fuer grc_app): eine Adresse rein,
 * hoechstens eine Zeile raus, nur die Anmeldefelder. Migration 0456 entfernt
 * danach die Disjunktion — dieselbe Bauform, die WP2 mit
 * `app_current_org_scope()` und WP3 mit den Token-Aufloesern schon benutzt.
 *
 * Bewusst dieselbe Filterung wie die abgeloeste Abfrage: `deleted_at IS NULL`
 * steht in der Funktion, `is_active` wertet der Aufrufer aus, damit ein
 * deaktiviertes Konto weiterhin wie ein unbekanntes aussieht (S02-17,
 * Enumerationsschutz).
 */
export interface LoginUserRow {
  id: string;
  email: string;
  name: string;
  language: string;
  passwordHash: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
}

export async function lookupUserByEmail(
  email: string,
): Promise<LoginUserRow | null> {
  const result = (await db.execute(
    sql`SELECT * FROM public.auth_lookup_user_by_email(${email})`,
  )) as unknown as Array<Record<string, unknown>>;
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: Array<Record<string, unknown>> }).rows ?? []);
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name ?? ""),
    language: String(row.language ?? "de"),
    passwordHash: (row.password_hash as string | null) ?? null,
    isActive: row.is_active === true,
    mustChangePassword: row.must_change_password === true,
  };
}

/**
 * #WP3-S02-17 — one normalisation rule for e-mail addresses.
 *
 * There were three login paths with two rules: the credentials provider
 * compared case-SENSITIVELY, while the SSO JIT path and `admin-login`
 * lower-cased. A user provisioned via SSO as `Max.Muster@firma.de` was stored
 * lower-cased and could not log in with the spelling he knew; conversely an
 * admin-console user with capitals could end up with a SECOND account through
 * the SSO path.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * F-03: Resolve the org an access-log row belongs to.
 *
 * A login event is only attributed to an org when the user is unambiguously
 * a member of exactly ONE org. If the user is unknown (no userId), or belongs
 * to multiple orgs, we return null → the row stays org-less and is NOT exposed
 * to any single Org-admin via GET /api/v1/access-log (which filters
 * org_id = <caller org> and thereby excludes NULL rows). Platform-wide review
 * of org-less events (e.g. brute-force against unknown emails) is a DB/DBA
 * concern, matching the append-only-log design of audit_log.
 */
async function resolveAccessLogOrgId(
  userId: string | undefined,
): Promise<string | null> {
  if (!userId) return null;
  try {
    // #SEC-AUTH-BOOTSTRAP: runs during login (no request context). Set
    // app.current_user_id so the uor_self_read policy (migration 0380) lets
    // grc_app read this user's own rows; org-scoped policies match nothing
    // pre-login. See withUserReadContext below.
    const rows = await withUserReadContext(userId, (tx) =>
      tx
        .select({ orgId: userOrganizationRole.orgId })
        .from(userOrganizationRole)
        .where(
          and(
            eq(userOrganizationRole.userId, userId),
            isNull(userOrganizationRole.deletedAt),
          ),
        ),
    );
    return pickAttributableOrgId(rows.map((r) => r.orgId));
  } catch {
    // Never let attribution failure break the auth flow — fall back to org-less.
    return null;
  }
}

/**
 * Write an entry to the access_log table.
 *
 * F-03: `orgId` is filled server-side. Callers that already know the org may
 * pass it explicitly; otherwise it is derived from the user's single org
 * membership (see resolveAccessLogOrgId). Rows with a NULL org_id are treated
 * as org-less and never returned to Org-admins.
 */
export async function logAccessEvent(params: {
  userId?: string;
  orgId?: string;
  emailAttempted: string;
  eventType:
    | "login_success"
    | "login_failed"
    | "logout"
    | "password_change"
    | "session_expired";
  authMethod?:
    | "password"
    | "sso_azure_ad"
    | "sso_oidc"
    | "api_key"
    | "mfa_totp"
    | "mfa_webauthn";
  failureReason?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const orgId = params.orgId ?? (await resolveAccessLogOrgId(params.userId));
  await db.insert(accessLog).values({
    orgId: orgId ?? null,
    userId: params.userId,
    emailAttempted: params.emailAttempted,
    eventType: params.eventType,
    authMethod: params.authMethod ?? "password",
    failureReason: params.failureReason,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  });
}

// Auth-bootstrap RLS context (#SEC-AUTH-BOOTSTRAP) is provided by the shared
// `withUserReadContext` helper in @grc/db (packages/db/src/request-context.ts).
// It reserves a dedicated BASE-pool connection and sets `app.current_user_id`
// on THAT exact connection, so the migration-0380 `uor_self_read` policy applies
// deterministically — without depending on the `db` proxy or db.transaction
// atomicity. loadRoles / resolveAccessLogOrgId (which run during authorize() and
// SSO JIT, outside any request context) and the NextAuth session callback's
// fresh-role fetch all route through it.

// [E2E-TRIAGE-2026-09-02] The ORDER BY below is not cosmetic.
//
// `config.ts` resolves the ACTIVE ORGANISATION as `roles[0]?.orgId ?? null`
// whenever no org cookie is set — i.e. on every fresh login, every new
// browser, every API client. This query had no ORDER BY at all, so `roles[0]`
// was whatever order Postgres happened to return the heap in; that order
// changes when a membership row is inserted or updated, or the table is
// vacuumed.
//
// Two consequences, both observed on the triage environment:
//   * A user with several memberships lands in a DIFFERENT tenant on different
//     logins, with nothing to predict which. For a multi-tenant GRC product
//     that is a correctness problem in its own right.
//   * It is the mechanism by which one E2E spec poisons the whole run:
//     `f-02-org-create` creates a throwaway organisation and its creator gets
//     an admin role on it. That row can become `roles[0]`, after which every
//     later spec runs against an EMPTY organisation — and stays there for the
//     next run as well, because the membership persists.
//
// Oldest membership first: the organisation a user was provisioned into is a
// stable and meaningful "home". `orgId` breaks ties between rows created in
// the same transaction (the seed grants several memberships at once, so the
// timestamp alone is not unique).
export async function loadRoles(userId: string): Promise<RoleAssignment[]> {
  const rows = await withUserReadContext(userId, (tx) =>
    tx
      .select({
        orgId: userOrganizationRole.orgId,
        role: userOrganizationRole.role,
        lineOfDefense: userOrganizationRole.lineOfDefense,
      })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.userId, userId),
          isNull(userOrganizationRole.deletedAt),
        ),
      )
      .orderBy(
        asc(userOrganizationRole.createdAt),
        asc(userOrganizationRole.orgId),
      ),
  );
  return rows as RoleAssignment[];
}

/**
 * Extract IP address and User-Agent from an incoming request.
 * Works with both standard Request and NextAuth's request objects.
 */
export function extractRequestInfo(request?: Request | { headers?: Headers }): {
  ipAddress: string | undefined;
  userAgent: string | undefined;
} {
  if (!request || !request.headers) {
    return { ipAddress: undefined, userAgent: undefined };
  }
  const headers = request.headers;
  // Prefer forwarded headers (reverse proxy / load balancer), fall back to direct connection
  const ipAddress =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    undefined;
  const userAgent = headers.get("user-agent") || undefined;
  return { ipAddress, userAgent };
}

/**
 * Sprint 20: Check if any org in the given list enforces SSO.
 * Returns true if at least one org has SSO enforcement enabled.
 */
async function checkSsoEnforcement(orgIds: string[]): Promise<boolean> {
  if (!orgIds.length) return false;
  try {
    const result = await db
      .select({ enforceSSO: ssoConfig.enforceSSO })
      .from(ssoConfig)
      .where(
        and(
          inArray(ssoConfig.orgId, orgIds),
          eq(ssoConfig.enforceSSO, true),
          eq(ssoConfig.isActive, true),
          isNull(ssoConfig.deletedAt),
        ),
      );
    return result.length > 0;
  } catch {
    // If sso_config table doesn't exist yet, no enforcement
    return false;
  }
}

export const credentialsProvider = Credentials({
  id: "credentials",
  name: "Email & Password",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials, request) {
    try {
      const rawEmail = credentials?.email as string | undefined;
      const password = credentials?.password as string | undefined;
      if (!rawEmail || !password) return null;
      // #WP3-S02-17: one normalisation rule across all three login paths.
      const email = normaliseEmail(rawEmail);

      // Extract IP and UA from the request (Auth.js v5 passes it as second arg)
      const { ipAddress, userAgent } = extractRequestInfo(request);

      // #WP3-S02-09: account lockout BEFORE any password work. Without this the
      // primary login accepted password attempts at line rate, against a
      // username that was published in the repository (S02-01).
      const lock = await checkLoginLock(email);
      if (lock.locked) {
        await equaliseTiming(password);
        await logAccessEvent({
          emailAttempted: email,
          eventType: "login_failed",
          failureReason: "account_locked",
          ipAddress,
          userAgent,
        });
        return null;
      }

      // [ARCTOS-FULL-2026-08-31 · OP-083] siehe `lookupUserByEmail`.
      const candidate = await lookupUserByEmail(email);
      const found = candidate?.isActive ? candidate : null;

      if (!found?.passwordHash) {
        // #WP3-S02-17: spend the same bcrypt cost as the hit path so the
        // response time no longer discloses whether the account exists.
        await equaliseTiming(password);
        await registerLoginFailure(email);
        await logAccessEvent({
          emailAttempted: email,
          eventType: "login_failed",
          failureReason: "user_not_found",
          ipAddress,
          userAgent,
        });
        return null;
      }

      // Sprint 20: Check SSO enforcement for user's orgs
      // If any org enforces SSO, only admins can use local login
      const roles = await loadRoles(found.id);
      const orgIds = [...new Set(roles.map((r) => r.orgId))];
      if (orgIds.length > 0) {
        const ssoEnforced = await checkSsoEnforcement(orgIds);
        if (ssoEnforced) {
          const isAdmin = roles.some((r) => r.role === "admin");
          if (!isAdmin) {
            await logAccessEvent({
              userId: found.id,
              emailAttempted: email,
              eventType: "login_failed",
              failureReason: "sso_enforced",
              ipAddress,
              userAgent,
            });
            return null;
          }
        }
      }

      const valid = await compare(password, found.passwordHash);
      if (!valid) {
        // #WP3-S02-09: count it. Ten failures lock the account for 15 minutes.
        await registerLoginFailure(email);
        await logAccessEvent({
          userId: found.id,
          emailAttempted: email,
          eventType: "login_failed",
          failureReason: "invalid_password",
          ipAddress,
          userAgent,
        });
        return null;
      }

      // #WP3-S02-09: resets the counter AND sets last_login_at, through the
      // SECURITY DEFINER helper — the previous bare UPDATE on `user` could not
      // work under `grc_app` (FORCE RLS, no org context at login time).
      await registerLoginSuccess(found.id);
      await logAccessEvent({
        userId: found.id,
        emailAttempted: email,
        eventType: "login_success",
        ipAddress,
        userAgent,
      });

      return {
        id: found.id,
        email: found.email,
        name: found.name,
        language: found.language,
        // #WP3-S02-01: a seeded or operator-provisioned account must change its
        // password before it can be used. The UI reads this off the session.
        mustChangePassword: found.mustChangePassword === true,
        roles,
      };
    } catch (err) {
      // Auth.js swallows authorize() rejections into a generic
      // CredentialsSignin — which means a DB driver / schema drift
      // issue looks identical to a wrong password in the UI. Always
      // log the full chain so post-mortems don't need a redeploy
      // with extra `console.log`s.
      if (err instanceof Error) {
        console.error("[auth] authorize error:", err.message);
        const cause = (err as Error & { cause?: unknown }).cause;
        if (cause instanceof Error) {
          console.error("  cause :", cause.message);
          const pg = cause as Error & {
            code?: string;
            detail?: string;
            hint?: string;
            where?: string;
          };
          if (pg.code) console.error("  code  :", pg.code);
          if (pg.detail) console.error("  detail:", pg.detail);
          if (pg.hint) console.error("  hint  :", pg.hint);
          if (pg.where) console.error("  where :", pg.where);
        } else if (cause) {
          console.error("  cause :", cause);
        }
        if (err.stack) console.error(err.stack);
      } else {
        console.error("[auth] authorize error:", err);
      }
      return null;
    }
  },
});

// ──────────────────────────────────────────────────────────────
// Azure AD (Microsoft Entra ID) SSO — S1-07
// Conditionally enabled when all three env vars are present.
// ──────────────────────────────────────────────────────────────

/** Returns true when Azure AD SSO environment variables are configured. */
export function isAzureAdConfigured(): boolean {
  return !!(
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
  );
}

/**
 * JIT (just-in-time) provisioning for SSO users.
 * If no user record exists for the given email, one is created.
 * Returns the user's id, email, name, language, and loaded roles.
 */
export async function jitProvisionSsoUser(profile: {
  email: string;
  name: string;
  ssoProviderId?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{
  id: string;
  email: string;
  name: string;
  language: string;
  roles: RoleAssignment[];
}> {
  const email = normaliseEmail(profile.email);

  // [ARCTOS-FULL-2026-08-31 · OP-083] Dieser Pfad laeuft aus dem
  // Auth.js-`signIn`-Callback, also ebenfalls ohne Request-Kontext. Lesen,
  // Buchen und Anlegen gehen jetzt ueber die drei Kapseln aus Migration 0455
  // statt ueber die kontextlose Disjunktion der `user`-Policy.
  const existing = await lookupUserByEmail(email);

  if (existing) {
    // Update last login + SSO provider link if not yet set
    await db.execute(
      sql`SELECT public.auth_sso_touch_login(${existing.id}::uuid, ${profile.ssoProviderId ?? null})`,
    );

    await logAccessEvent({
      userId: existing.id,
      emailAttempted: email,
      eventType: "login_success",
      authMethod: "sso_azure_ad",
      ipAddress: profile.ipAddress,
      userAgent: profile.userAgent,
    });

    const roles = await loadRoles(existing.id);
    return {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      language: existing.language,
      roles,
    };
  }

  // JIT: Create new user record for first-time SSO login.
  // [ARCTOS-FULL-2026-08-31 · OP-083] Der INSERT selbst duerfte auch nach 0456
  // durchgehen (die INSERT-Policy bleibt permissiv), sein `RETURNING` aber
  // nicht: es wird gegen die SELECT-Policy ausgewertet, und die trifft ohne
  // Kontext nicht mehr. Deshalb die Kapsel — sie legt genau eine Zeile OHNE
  // Rollen an; die Mitgliedschaft vergibt weiterhin ein Administrator.
  const createdRows = (await db.execute(
    sql`SELECT * FROM public.auth_sso_provision_user(
          ${email}, ${profile.name || email},
          ${profile.ssoProviderId ?? null}, ${"de"})`,
  )) as unknown as Array<Record<string, unknown>>;
  const createdList = Array.isArray(createdRows)
    ? createdRows
    : ((createdRows as { rows?: Array<Record<string, unknown>> }).rows ?? []);
  const createdRow = createdList[0];
  if (!createdRow) {
    throw new Error("SSO JIT provisioning did not return a user row");
  }
  const created = {
    id: String(createdRow.id),
    email: String(createdRow.email),
    name: String(createdRow.name ?? ""),
    language: String(createdRow.language ?? "de"),
  };

  await logAccessEvent({
    userId: created.id,
    emailAttempted: email,
    eventType: "login_success",
    authMethod: "sso_azure_ad",
    ipAddress: profile.ipAddress,
    userAgent: profile.userAgent,
  });

  // New user has no roles yet — admin must assign via user management
  return {
    id: created.id,
    email: created.email,
    name: created.name,
    language: created.language,
    roles: [],
  };
}

/**
 * Build the Azure AD (Microsoft Entra ID) provider.
 * Uses OIDC protocol with tenant-scoped issuer for organization-only login.
 * Returns undefined when env vars are missing so it can be filtered out.
 */
export function buildAzureAdProvider(): Provider | undefined {
  if (!isAzureAdConfigured()) return undefined;

  return MicrosoftEntraID({
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
    issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID!}/v2.0`,
    authorization: {
      params: {
        scope: "openid profile email",
      },
    },
    // Map Entra ID profile fields to the user object for the signIn callback
    profile(profile) {
      return {
        id: profile.oid ?? profile.sub,
        email: profile.email ?? profile.preferred_username,
        name: profile.name ?? profile.preferred_username,
        image: null,
      };
    },
  });
}
