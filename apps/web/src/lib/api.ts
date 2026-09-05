// Shared API helpers — auth, pagination, audit context
import { auth } from "@/auth";
import { getCurrentOrgId } from "@grc/auth/context";
import {
  requireRole,
  requireModule,
  isHinSchgIsolated,
  isHinSchgAllowedPath,
} from "@grc/auth";
import {
  moduleScopeForPath,
  mutatingRolesForPath,
  requiresPlatformAdmin,
  DEFAULT_MUTATING_ROLES,
} from "@/lib/module-guard";
import { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE } from "@/lib/pagination-contract";
import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import type { Session } from "next-auth";
import type { UserRole } from "@grc/shared";
import type { DbTransaction } from "@/lib/db-types";

import { log } from "@/lib/logger";
export interface ApiContext {
  session: Session;
  orgId: string;
  userId: string;
  roles?: string[];
}

// #WAVE13-RBAC-Forbidden-Format: all auth-failure responses out of withAuth
// are now RFC 7807 problem+json. The middleware stamps x-request-id on every
// incoming request, so reading it here just propagates the same id into the
// error body for log correlation.
const PROBLEM_BASE = "https://arctos.charliehund.de/errors";

async function readRequestId(): Promise<string> {
  try {
    const h = await headers();
    return h.get("x-request-id") ?? "";
  } catch {
    // headers() can throw in non-request contexts (e.g. some test fixtures);
    // fall back to empty string — the response is still RFC-7807 valid.
    return "";
  }
}

function authProblem(
  status: number,
  type: string,
  title: string,
  detail: string,
  requestId: string,
): Response {
  return new Response(
    JSON.stringify({ type, title, status, detail, requestId }),
    {
      status,
      headers: {
        "Content-Type": "application/problem+json; charset=utf-8",
      },
    },
  );
}

/**
 * #SEC-F01b — Establish the request-scoped RLS context for the rest of THIS
 * request's async execution.
 *
 * A Next.js route handler cannot wrap "the rest of itself" in a callback, so we
 * use `AsyncLocalStorage.enterWith` (propagates the store to every subsequent
 * `await` in the handler) and register cleanup with `after()` (runs once the
 * response has finished — including on error — which is our request-end
 * `finally`). The connection is reserved and configured FIRST; only once
 * `after(release)` is registered do we `enterWith`, so a released connection is
 * never pinned to the ALS.
 *
 * Failure modes are all safe-fail:
 *  - `after()` unavailable (a unit test calling withAuth outside a request):
 *    release immediately, do NOT enterWith → the request falls back to the base
 *    pool (its pre-existing behaviour). Nothing leaks.
 *  - reserve() fails (pool exhausted / DB blip): the request is REFUSED with
 *    503 — see the S01-21 note below.
 *
 * [ARCTOS-FULL-2026-08-31 / WP2 · S01-21]
 * Hier stand: bei einem Fehlschlag von `reserve()` wird geloggt und ohne
 * Kontext weitergemacht, weil der Handler dann RLS-gefilterte (leere) Reads
 * sieht — "which is the safe direction to fail".
 *
 * Diese Zusage galt nur für die Tabellenklasse MIT org_id-Policy. Für die
 * Objekte, in denen Stream S01 die Lecks nachgewiesen hat, galt sie nicht:
 * `audit_log`, `access_log`, `user`, die Kindtabellen ohne `org_id` und die
 * Views trugen gar keine Policy — dort entschied allein ein handgeschriebener
 * Filter, der Fallback war für sie fail-OPEN.
 *
 * WP2 hat diese Objekte unter RLS gestellt, der Fallback wäre heute also
 * tatsächlich fail-closed. Abgelehnt wird trotzdem hart, aus zwei Gründen:
 * (a) ein stiller Fallback macht eine Sicherheitsvoraussetzung von der
 * Pool-Auslastung abhängig, und (b) "leere Antwort statt Fehler" ist für den
 * Aufrufer nicht von "es gibt keine Daten" zu unterscheiden — eine erschöpfte
 * Verbindungsreserve sähe aus wie ein leerer Mandant. 503 mit `Retry-After`
 * ist die ehrliche Antwort.
 *
 * Rückgabe: `undefined` = Kontext steht (oder fehlt im Unittest bewusst,
 * weil `@grc/db` gemockt ist), `Response` = der Request wird abgelehnt.
 */
async function establishRequestScopedContext(ctx: {
  orgId: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
}): Promise<Response | undefined> {
  // The context helpers are imported DYNAMICALLY (not as top-level named
  // imports) so the many unit tests that `vi.mock("@grc/db", …)` with just a
  // `db` stub don't fail the strict missing-named-export check. When the module
  // is mocked (no `reserveRequestContext`), we simply skip context setup — the
  // test then exercises withAuth against its mocked `db`, exactly as before.
  type MutableStore = {
    db: unknown;
    reserved: unknown;
    orgId: string;
    userId: string;
    released: boolean;
  };
  let reserved:
    { store: MutableStore; release: () => Promise<void> } | undefined;
  try {
    const dbmod = (await import("@grc/db")) as {
      reserveRequestContext?: (c: typeof ctx) => Promise<{
        store: MutableStore;
        release: () => Promise<void>;
      }>;
      requestDbStorage?: {
        enterWith: (s: unknown) => void;
        getStore: () => MutableStore | undefined;
      };
    };
    // #WP3: vitest 4 THROWS on reading a named export that a `vi.mock` factory
    // did not define, so the two reads below must not sit inside the outer
    // try/catch that WP2 turned into a 503 (S01-21) — otherwise every existing
    // unit test that mocks `@grc/db` with just a `db` stub gets 503 instead of
    // the documented "skip context setup" behaviour. Read them defensively;
    // a genuine reserve() failure still lands in the 503 path below.
    let reserveRequestContext: typeof dbmod.reserveRequestContext;
    let requestDbStorage: typeof dbmod.requestDbStorage;
    try {
      reserveRequestContext = dbmod.reserveRequestContext;
      requestDbStorage = dbmod.requestDbStorage;
    } catch {
      return;
    }
    if (typeof reserveRequestContext !== "function" || !requestDbStorage) {
      // @grc/db is mocked (unit test) — nothing to establish.
      return;
    }

    reserved = await reserveRequestContext(ctx);

    // #SEC-F01b-RUN — Preferred path: withErrorHandler already opened a
    // `requestDbStorage.run(...)` frame around this handler, so there is a
    // mutable store bound to the current async context. MUTATE it (swap in the
    // reserved, org/user-pinned connection). Because `run()` establishes the ALS
    // frame for the WHOLE async execution and the `db` proxy reads `store.db`
    // dynamically, this propagates reliably back into the route body — unlike
    // `enterWith`, which Next silently drops across the withAuth `await`.
    const current = requestDbStorage.getStore();
    if (current) {
      current.db = reserved.store.db;
      current.reserved = reserved.store.reserved;
      current.orgId = reserved.store.orgId;
      current.userId = reserved.store.userId;
      current.released = false;
      try {
        after(reserved.release);
      } catch {
        // Not inside a Next request scope (e.g. an integration test invoking the
        // handler directly).
        //
        // [E2E-TRIAGE-2026-09-02] This used to return WITHOUT releasing, on the
        // reasoning "the reserved connection is released when the pool closes;
        // production always has after() inside a request". A long-running
        // server's pool never closes, so that is a leak for the lifetime of the
        // process — and the FALLBACK branch below already releases in exactly
        // this situation. Do the same here. `releaseRequestContext` is
        // idempotent, so an `after()` that fires later is harmless.
        void reserved.release().catch(() => {});
      }
      return;
    }

    // Fallback: no run() frame (route NOT wrapped in withErrorHandler, or a
    // non-Next caller). Use the previous enterWith best-effort path — it may not
    // propagate under Next, but there is no run-bound store to mutate here. Such
    // routes are listed in the fix PR's coverage analysis; they should adopt
    // withErrorHandler.
    try {
      after(reserved.release);
    } catch {
      await reserved.release();
      return;
    }
    requestDbStorage.enterWith(reserved.store);
  } catch (err) {
    if (reserved) {
      // reserve succeeded but enterWith/after threw — don't leak the connection.
      await reserved.release().catch(() => {});
    }
    log.error("[rls-context] failed to establish request-scoped context", {
      err,
    });
    // [WP2 · S01-21] Fail closed, laut und unterscheidbar — nicht still auf
    // den kontextlosen Basis-Pool zurückfallen.
    return new Response(
      JSON.stringify({
        type: `${PROBLEM_BASE}/tenant-context-unavailable`,
        title: "Service Unavailable",
        status: 503,
        detail:
          "The tenant-scoped database context could not be established. " +
          "The request was refused rather than served without tenant isolation.",
      }),
      {
        status: 503,
        headers: {
          "content-type": "application/problem+json",
          "retry-after": "2",
        },
      },
    );
  }
  return undefined;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * The request path + method as stamped by the edge middleware
 * (`x-arctos-path` / `x-arctos-method`).
 *
 * #WP3: the middleware is the only layer that reliably knows the routed path,
 * so it now forwards it as a request header. Everything that depends on it
 * fails CLOSED when the header is absent (unit tests calling withAuth outside a
 * request, or a future runtime that skips the middleware): no module can be
 * resolved, so the custom-role fallback is denied and the strict default role
 * floor applies.
 */
async function readRoutingInfo(): Promise<{
  path: string | null;
  method: string | null;
}> {
  try {
    const h = await headers();
    return {
      path: h.get("x-arctos-path"),
      method: h.get("x-arctos-method"),
    };
  } catch {
    return { path: null, method: null };
  }
}

/** Authenticate, resolve org, check roles. Returns context or error Response. */
export async function withAuth(
  ...roles: UserRole[]
): Promise<ApiContext | Response> {
  const session = await auth();
  const requestId = await readRequestId();

  if (!session?.user?.id) {
    return authProblem(
      401,
      `${PROBLEM_BASE}/unauthorized`,
      "Unauthorized",
      "Authentication required",
      requestId,
    );
  }

  // #WP3-S12-17 — a deactivated or deleted user kept a fully functional session
  // for the whole JWT lifetime because nothing re-checked `isActive`/`deletedAt`
  // after login. The session callback now flags it; deny immediately.
  if ((session.user as { disabled?: boolean }).disabled) {
    return authProblem(
      401,
      `${PROBLEM_BASE}/unauthorized`,
      "Unauthorized",
      "This account is deactivated. Please sign in again.",
      requestId,
    );
  }

  const orgId = await getCurrentOrgId(session);
  if (!orgId) {
    return authProblem(
      400,
      `${PROBLEM_BASE}/no-org-selected`,
      "No organization selected",
      "An active organization context is required for this endpoint.",
      requestId,
    );
  }

  // #SEC-F01b — establish the request-scoped RLS context now, BEFORE the role
  // checks below, so even the permission-lookup queries run under this org's
  // RLS scope. From here on every query the handler makes through the global
  // `db` proxy is org/user-scoped, without any route change.
  const contextFailure = await establishRequestScopedContext({
    orgId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
  });
  // [WP2 · S01-21] Ohne Mandantenkontext wird nicht weitergearbeitet.
  if (contextFailure) return contextFailure;

  const { path, method } = await readRoutingInfo();
  const upperMethod = (method ?? "").toUpperCase();
  const isMutating = MUTATING_METHODS.has(upperMethod);

  // ── S12-17: HinSchG-Isolation auch im Node-Runtime ────────────────
  // Das Gatter stand ausschließlich in der Edge-Middleware und bewertete die
  // JWT-Kopie der Rollen. Wurde einem Nutzer die zweite Rolle entzogen, GERADE
  // DAMIT die Isolation greift, blieb er bis zu 8 Stunden uneingeschränkt.
  // Hier greift es auf den frisch aus der DB gelesenen Rollenstand.
  const sessionRoles =
    (session.user as { roles?: Array<{ orgId: string; role: string }> })
      .roles ?? [];
  if (path && isHinSchgIsolated(sessionRoles) && !isHinSchgAllowedPath(path)) {
    return authProblem(
      403,
      `${PROBLEM_BASE}/forbidden`,
      "Forbidden",
      "HinSchG officers (whistleblowing_officer, ombudsperson) are confined to " +
        "the whistleblowing module to preserve reporter confidentiality " +
        "(§§16, 32 HinSchG).",
      requestId,
    );
  }

  // ── S02-03: plattformweite Konfiguration ──────────────────────────
  // `feature_gate`, `subscription_plan`, `plugin`, `data_region` und
  // `framework_mapping` haben kein `org_id` und keine RLS. Ein Schreibzugriff
  // darauf wirkt auf ALLE Mandanten und darf deshalb nicht mit der
  // mandantengebundenen Rolle `admin` möglich sein.
  if (path && requiresPlatformAdmin(path, upperMethod)) {
    if (!(await isPlatformAdmin(session.user.id))) {
      return authProblem(
        403,
        `${PROBLEM_BASE}/platform-admin-required`,
        "Platform administrator required",
        "This endpoint changes platform-wide configuration that affects every " +
          "tenant. The organization-scoped role 'admin' is not sufficient; a " +
          "platform administrator (table platform_admin) is required.",
        requestId,
      );
    }
  }

  // ── S02-10: Rollenuntergrenze für mutierende Routen ───────────────
  // `withAuth()` ohne Rollenargument übersprang den Rollenblock vollständig
  // (`if (roles.length)`), sodass 91 mutierende Endpunkte auch für `viewer`
  // offen standen. Ohne explizite Rollen greift jetzt die Registry.
  let effectiveRoles: readonly UserRole[] = roles;
  if (!effectiveRoles.length && isMutating) {
    effectiveRoles = path
      ? mutatingRolesForPath(path)
      : // Kein Pfad ermittelbar → fail closed auf die engste sinnvolle Menge.
        DEFAULT_MUTATING_ROLES;
  }

  if (effectiveRoles.length) {
    const check = requireRole(...effectiveRoles)(session, orgId, requestId);
    if (check) {
      // ── S02-02 / S12-14 (Critical) ────────────────────────────────
      // Der bisherige Fallback prüfte lediglich, ob der Nutzer IRGENDEINE
      // Custom-Rolle mit IRGENDEINER Berechtigung ungleich 'none' in der Org
      // besitzt — ohne Modul- und ohne Aktionsbezug. Damit bestand jeder
      // Nutzer mit einer beliebigen Custom-Rolle JEDE Rollenprüfung der
      // Plattform, inklusive `withAuth("admin")` auf
      // `POST /users/:id/roles` → Selbstzuweisung der Admin-Rolle.
      //
      // Der Fallback ist jetzt modul- UND aktionsbewusst:
      //   * er greift nur, wenn die Route einem Fachmodul zugeordnet ist
      //     (`platform`-Routen wie /users, /organizations, /admin, /auth sind
      //     ausgeschlossen — dort gibt es keine Custom-Rollen-Semantik);
      //   * er verlangt genau die Aktion, die die Anfrage braucht
      //     (GET → read, mutierend → write, admin-only Guard → admin);
      //   * ohne ermittelbaren Pfad greift er gar nicht (fail closed).
      const granted = await customRoleFallbackGrants({
        userId: session.user.id,
        orgId,
        path,
        method: upperMethod,
        requiredRoles: effectiveRoles,
      });
      if (!granted) return check;
    }
  }

  // ── S02-11: Modul-Freischaltung und Preview-Schreibschutz ─────────
  // 368 von 985 mutierenden Handlern riefen `requireModule` nicht auf.
  // Der zentrale Guard zieht das nach; Routen mit eigenem Aufruf behalten ihn
  // (der Cache macht die Doppelprüfung praktisch kostenlos).
  if (path && method) {
    const scope = moduleScopeForPath(path);
    if (scope && scope !== "platform") {
      const blocked = await requireModule(scope, orgId, upperMethod);
      if (blocked) return blocked;
    }
  }

  return {
    session,
    orgId,
    userId: session.user.id,
    roles: (
      session.user as { roles?: Array<{ orgId: string; role: string }> }
    ).roles
      ?.filter((r) => r.orgId === orgId)
      .map((r) => r.role),
  };
}

/**
 * #WP3-S02-03 — is this user a platform administrator?
 *
 * Reads through the SECURITY DEFINER helper from migration 0412 so the check
 * also works on paths without an org context. The `platform_admin` table has
 * no INSERT/UPDATE/DELETE policy for `grc_app`: the application can ask the
 * question but can never grant the answer.
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  try {
    const result = (await db.execute(
      sql`SELECT public.auth_is_platform_admin(${userId}::uuid) AS is_admin`,
    )) as unknown as Array<Record<string, unknown>>;
    const rows = Array.isArray(result)
      ? result
      : ((result as { rows?: Array<Record<string, unknown>> }).rows ?? []);
    return rows[0]?.is_admin === true;
  } catch (err) {
    // Fail closed. A missing function (migration not yet applied) must deny,
    // never grant — otherwise the fix would be weaker than the finding.
    log.error("[platform-admin] check failed, denying", { err });
    return false;
  }
}

/**
 * Guard for routes that change platform-wide configuration. Returns a
 * problem+json Response when the caller is not a platform administrator.
 */
export async function requirePlatformAdmin(
  ctx: ApiContext,
): Promise<Response | null> {
  if (await isPlatformAdmin(ctx.userId)) return null;
  return authProblem(
    403,
    `${PROBLEM_BASE}/platform-admin-required`,
    "Platform administrator required",
    "This endpoint changes platform-wide configuration that affects every " +
      "tenant. The organization-scoped role 'admin' is not sufficient.",
    await readRequestId(),
  );
}

/**
 * #WP3-S02-02 / S12-14 — module- and action-aware custom-role fallback.
 *
 * Replaces `checkCustomRoleAccess()`, which asked only "does this user hold ANY
 * custom role with ANY permission in this org?" and therefore satisfied every
 * role guard in the product.
 */
async function customRoleFallbackGrants(args: {
  userId: string;
  orgId: string;
  path: string | null;
  method: string;
  requiredRoles: readonly UserRole[];
}): Promise<boolean> {
  const { userId, orgId, path, method, requiredRoles } = args;

  // No routed path → no module → no fallback. Fail closed.
  if (!path) return false;

  const scope = moduleScopeForPath(path);
  // `platform` covers user/org/auth/billing administration. Custom roles are
  // module permissions; they must never substitute for those.
  if (!scope || scope === "platform") return false;

  // Which action does this request need?
  //  - the guard asks for `admin` only          → module action `admin`
  //  - a mutating method                        → module action `write`
  //  - otherwise                                → module action `read`
  const adminOnlyGuard =
    requiredRoles.length > 0 && requiredRoles.every((r) => r === "admin");
  const requiredAction: "read" | "write" | "admin" = adminOnlyGuard
    ? "admin"
    : MUTATING_METHODS.has(method)
      ? "write"
      : "read";

  return checkCustomRoleModuleAccess(userId, orgId, scope, requiredAction);
}

/**
 * Check if user has custom role permission for a specific module + action.
 * action hierarchy: admin > write > read > none
 */
export async function checkCustomRoleModuleAccess(
  userId: string,
  orgId: string,
  moduleKey: string,
  requiredAction: "read" | "write" | "admin" = "read",
): Promise<boolean> {
  const actionHierarchy: Record<string, number> = {
    none: 0,
    read: 1,
    write: 2,
    admin: 3,
  };
  const requiredLevel = actionHierarchy[requiredAction] ?? 1;

  const result = await db.execute(
    sql`SELECT rp.action FROM user_custom_role ucr
        JOIN role_permission rp ON rp.role_id = ucr.custom_role_id
        WHERE ucr.user_id = ${userId}
          AND ucr.org_id = ${orgId}
          AND rp.module_key = ${moduleKey}
        ORDER BY CASE rp.action
          WHEN 'admin' THEN 3 WHEN 'write' THEN 2
          WHEN 'read' THEN 1 ELSE 0 END DESC
        LIMIT 1`,
  );

  if (!result?.length) return false;
  const userLevel =
    actionHierarchy[(result[0] as Record<string, string>).action] ?? 0;
  return userLevel >= requiredLevel;
}

// #WAVE6-AUDIT-02: optional audit annotation passed by callers that
// do meaningful state transitions. Both fields land in the audit_log
// row written by the trigger:
//   actionDetail → audit_log.action_detail (varchar 500, summary)
//   reason       → audit_log.metadata.reason
// Callers omit them for trivial CRUD; state-machine transitions
// should set both for compliance traceability.
export interface AuditAnnotation {
  actionDetail?: string;
  reason?: string;
}

/**
 * Grösste Länge einer Begründung in `audit_log.metadata`.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-124] Vorher: „full text, no length cap".
 */
export const MAX_AUDIT_REASON_LENGTH = 500;

/**
 * Entfernt aus einer Audit-Begründung, was ein Löschantrag später nicht mehr
 * herausbekommt.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-124]
 *
 * Warum das nötig ist, und zwar genau hier: `audit_log.metadata` ist unter
 * Hash-Formel v4 **direkte** Hash-Eingabe (Migration 0400,
 * `entry_hash = SHA256(… | metadata | …)`). Alles andere Personenbezogene im
 * Audit-Eintrag steckt hinter dem `content_commitment` — `changes`,
 * `user_email`, `user_name`, `entity_title` — und genau deshalb kann
 * `tombstone_audit_entry()` es überschreiben, ohne die Kette zu brechen.
 * `metadata` kann es nicht: jede Änderung dort ändert `entry_hash`, und der
 * Guard `audit_log_tombstone_only_guard()` lässt sie folgerichtig gar nicht
 * erst zu.
 *
 * Gemessen: `POST /api/v1/isms/incidents/{id}/notify-authority` nimmt
 * `reason` als `z.string().min(1).max(5000)` vom Aufrufer entgegen und reicht
 * es unverändert hierher. Steht darin eine E-Mail-Adresse, überlebt sie eine
 * DSGVO-Art.-17-Löschung — dauerhaft, in einer Tabelle, aus der per
 * Konstruktion nichts gelöscht werden kann.
 *
 * Warum bereinigen und nicht ablehnen: Die vollständige Begründung geht
 * dadurch nicht verloren. Sie steht in der Fachzeile selbst
 * (`security_incident.notification_reason`) und im `changes`-Diff desselben
 * Audit-Eintrags — beides redigierbar. Was hier steht, ist eine **Kopie**;
 * eine unlöschbare Kopie eines löschbaren Feldes ist der ganze Defekt. Eine
 * Ablehnung würde dagegen einen rechtmässigen Vorgang (die Meldung an die
 * Aufsichtsbehörde) an der Formulierung seiner Begründung scheitern lassen.
 *
 * Was entfernt wird, ist bewusst eng: zwei Muster, die sich mit hoher
 * Trefferschärfe erkennen lassen und die den Grossteil der Art.-17-Fälle
 * ausmachen. Was NICHT erkannt wird — ein Klarname etwa —, bleibt eine
 * benannte Lücke; die vollständige Lösung ist Hash-v5, die `metadata` unter
 * das `content_commitment` zieht (Übergabe, siehe docs/UMSETZUNG-WELLE-1B.md).
 */
export function sanitiseAuditReason(reason: unknown): string {
  if (typeof reason !== "string") return "";
  return (
    reason
      // E-Mail-Adressen.
      .replace(/[^\s<>()[\],;:"]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[E-Mail]")
      // Ziffernfolgen ab sieben Stellen: Telefon-, Versicherungs-,
      // Personal-, Steuer- und Kontonummern. Kürzere Zahlen sind
      // Aktenzeichen, Beträge und Fristen — die trägt eine Begründung zu
      // Recht.
      .replace(/\d[\d\s/.-]{5,}\d/g, "[Nummer]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_AUDIT_REASON_LENGTH)
  );
}

/** Wrap a mutation in a transaction with audit session variables. */
export async function withAuditContext<T>(
  ctx: ApiContext,
  // [WP12 · S14-19] was `tx: any` — see lib/db-types.ts
  fn: (tx: DbTransaction) => Promise<T>,
  annotation?: AuditAnnotation,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${ctx.orgId}, true)`,
    );
    await tx.execute(
      sql`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`,
    );
    await tx.execute(
      sql`SELECT set_config('app.current_user_email', ${ctx.session.user.email}, true)`,
    );
    await tx.execute(
      sql`SELECT set_config('app.current_user_name', ${ctx.session.user.name}, true)`,
    );
    // Optional state-transition annotation. Always set to something
    // (empty string) so a leftover value from a previous transaction
    // on the same connection can't bleed across — the audit_trigger
    // treats empty as NULL.
    await tx.execute(
      sql`SELECT set_config('app.audit_action_detail', ${annotation?.actionDetail ?? ""}, true)`,
    );
    // [ARCTOS-FULL-2026-08-31 · OP-124] Der einzige Schreibpfad nach
    // `audit_log.metadata.reason` — und damit die einzige Stelle, an der sich
    // verhindern lässt, dass Klartext in eine nicht redigierbare Hash-Eingabe
    // gerät. Begründung siehe `sanitiseAuditReason`.
    await tx.execute(
      sql`SELECT set_config('app.audit_reason', ${sanitiseAuditReason(annotation?.reason)}, true)`,
    );
    return fn(tx);
  });
}

/**
 * Wrap a read-only query in a transaction with RLS session vars.
 * Required for raw-SQL reads -- without `app.current_org_id` the RLS policy
 * filters out every row even if the query has an explicit `WHERE org_id = ...`.
 */
export async function withReadContext<T>(
  ctx: ApiContext,
  // [WP12 · S14-19] was `tx: any` — see lib/db-types.ts
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${ctx.orgId}, true)`,
    );
    await tx.execute(
      sql`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`,
    );
    return fn(tx);
  });
}

// Pagination contract — surfaces structured errors instead of silent
// coercion (over-night QA #NIGHT-057..060):
//   - limit=0 / -1 / "abc" → throw PaginationError (was: silently → 1)
//   - limit > MAX_PAGE_SIZE → throw PaginationError (→ 422)
//     [ARCTOS-FULL-2026-08-31 · OP-050] Hier stand bis heute das Gegenteil
//     dessen, was der Code tut ("silently capped … we don't refuse the
//     request"). Die Zeile ist die plausibelste Quelle der 30 Aufrufstellen
//     mit `limit=200`: sie sagt dem Leser zu, eine zu grosse Zahl sei
//     harmlos. Sie war seit #NIGHT-059 falsch.
//   - page=0 / -1 / "abc"  → throw PaginationError (was: silently → 1)
//   - offset=N (no page)   → derive page = floor(N/limit)+1; throw if
//                            offset isn't a clean page boundary so the
//                            caller doesn't get a surprising slice
//   - offset and page both → page wins (explicit beats derived)
//
// withErrorHandler maps PaginationError to a 422 problem+json body
// with field-level details. Routes that opt into `allowedParams`
// additionally get unknown-param rejection.

// #NIGHT-039: UI sometimes sends empty-string params (e.g. `&search=`)
// when the user hasn't filled the input. The downstream Zod schema then
// rejects "" as an invalid enum value or short string. Treat empty
// strings as missing — the caller didn't actually express a constraint.
export function searchParamsToObject(
  searchParams: URLSearchParams,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of searchParams) {
    if (value !== "") out[key] = value;
  }
  return out;
}

// [ARCTOS-FULL-2026-08-31 · OP-050] Die Zahlen stehen jetzt in
// `lib/pagination-contract.ts` — einem Blattmodul ohne Importe, damit auch
// Client-Code sie lesen kann, ohne `@/auth` und `@grc/db` ins Browser-Bundle
// zu ziehen. Re-Export, damit die Routen ihren Importpfad behalten.
export { MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE };

export class PaginationError extends Error {
  readonly field: string;
  readonly value: string;
  readonly reason: string;
  constructor(field: string, value: string, reason: string) {
    super(`Invalid pagination: ${field}=${value} (${reason})`);
    this.name = "PaginationError";
    this.field = field;
    this.value = value;
    this.reason = reason;
  }
}

function parsePositiveInt(
  field: string,
  raw: string,
  { allowZero }: { allowZero: boolean },
): number {
  if (!/^-?\d+$/.test(raw)) {
    throw new PaginationError(field, raw, "must be an integer");
  }
  const n = Number(raw);
  const min = allowZero ? 0 : 1;
  if (n < min) {
    throw new PaginationError(
      field,
      raw,
      allowZero ? "must be >= 0" : "must be >= 1",
    );
  }
  return n;
}

/** Parse pagination params from request or search params. */
export function paginate(
  reqOrParams: Request | URLSearchParams,
  opts?: { allowedParams?: readonly string[] },
) {
  const sourceParams =
    reqOrParams instanceof Request
      ? new URL(reqOrParams.url).searchParams
      : reqOrParams;

  // #WAVE16-P0-A: the UI sends `sortBy` / `sortOrder` (the idiom every
  // public REST API uses), but route handlers historically read `sort`
  // and `sortDir`. Wave-14's strict allow-list then rejected `sortBy`
  // as an unknown param → /risks and /controls UI stayed broken even
  // after the limit=500 fix. Normalise the well-known aliases up-front
  // so both names are accepted and downstream handlers + the strict
  // allow-list see the canonical form only. Clone the searchParams so
  // we don't mutate the caller's URL object.
  const searchParams = new URLSearchParams(sourceParams);
  const SORT_ALIASES: Record<string, string> = {
    sortBy: "sort",
    sortOrder: "sortDir",
  };
  for (const [alias, canonical] of Object.entries(SORT_ALIASES)) {
    const aliasValue = searchParams.get(alias);
    if (aliasValue !== null && searchParams.get(canonical) === null) {
      searchParams.set(canonical, aliasValue);
    }
    if (searchParams.has(alias)) {
      searchParams.delete(alias);
    }
  }

  const rawLimit = searchParams.get("limit");
  let limit = DEFAULT_PAGE_SIZE;
  if (rawLimit !== null) {
    const n = parsePositiveInt("limit", rawLimit, { allowZero: false });
    // #NIGHT-059: caller asked for more rows than the page-size cap.
    // Reject explicitly instead of silently capping — silent caps mean
    // the caller never learns the API has a ceiling and keeps assuming
    // they got the full result set.
    if (n > MAX_PAGE_SIZE) {
      throw new PaginationError(
        "limit",
        rawLimit,
        `must be <= ${MAX_PAGE_SIZE} (use page+limit to traverse larger result sets)`,
      );
    }
    limit = n;
  }

  const rawPage = searchParams.get("page");
  const rawOffset = searchParams.get("offset");
  let page = 1;
  if (rawPage !== null) {
    page = parsePositiveInt("page", rawPage, { allowZero: false });
  } else if (rawOffset !== null) {
    const n = parsePositiveInt("offset", rawOffset, { allowZero: true });
    if (n % limit !== 0) {
      throw new PaginationError(
        "offset",
        rawOffset,
        `must be a multiple of limit (${limit})`,
      );
    }
    page = Math.floor(n / limit) + 1;
  }

  // #NIGHT-060: surface common pagination-param typos even when the
  // route hasn't opted into a strict allow-list. These are the names
  // a developer might assume work (because they do in other APIs)
  // and silently get nothing back. Throwing is the only way to make
  // the mistake visible.
  const COMMON_PAGINATION_TYPOS = new Set([
    "skip",
    "cursor",
    "page_size",
    "pageSize",
    "perPage",
    "per_page",
    "count",
    "top",
    "start",
  ]);
  for (const key of searchParams.keys()) {
    if (COMMON_PAGINATION_TYPOS.has(key)) {
      throw new PaginationError(
        key,
        searchParams.get(key) ?? "",
        `'${key}' is not a recognised pagination parameter — use page, limit, or offset`,
      );
    }
  }

  if (opts?.allowedParams) {
    const known = new Set<string>([
      "page",
      "limit",
      "offset",
      ...opts.allowedParams,
    ]);
    for (const key of searchParams.keys()) {
      if (!known.has(key)) {
        throw new PaginationError(
          key,
          searchParams.get(key) ?? "",
          "is not a recognized query parameter",
        );
      }
    }
  }

  return { page, limit, offset: (page - 1) * limit, searchParams };
}

/** Build a paginated JSON response. */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return Response.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
