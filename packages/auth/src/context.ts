// Auth context helpers (S1-03, S1-19)
// getCurrentOrgId reads the org cookie; withOrgContext sets RLS per request.

import { cookies } from "next/headers";
import { db, runWithRequestContext, type Database } from "@grc/db";
import type { Session } from "next-auth";

const ORG_COOKIE = "arctos-org-id";

/**
 * Read the currently selected org ID from the cookie.
 * Falls back to the first accessible org from the session.
 *
 * SECURITY: The cookie value is validated against the user's role
 * assignments in the JWT. If the cookie contains an org ID the user
 * does not have access to, it is ignored and the first accessible org
 * is returned instead. This prevents cookie manipulation attacks.
 */
export async function getCurrentOrgId(
  session: Session | null,
): Promise<string | null> {
  // Build the set of org IDs this user actually has roles in
  const accessibleOrgIds = new Set(
    session?.user?.roles?.map((r) => r.orgId) ?? [],
  );

  const jar = await cookies();
  const fromCookie = jar.get(ORG_COOKIE)?.value;

  // Only use the cookie value if the user has a role in that org
  if (fromCookie && accessibleOrgIds.has(fromCookie)) {
    return fromCookie;
  }

  // Fallback: first org in the user's roles
  // [OP-065] `roles.length` wurde geprüft, `roles[0]` dann ungeprüft gelesen.
  // Der Wert statt der Länge: fehlt die erste Rolle, gibt es auch keine
  // Organisation — und `null` ist die Antwort, die diese Funktion dafür schon
  // kennt. Ein `!` hätte an dieser Stelle einen TypeError im Auth-Kontext
  // erzeugt, also in jedem Request.
  const firstRole = session?.user?.roles?.[0];
  if (firstRole) {
    return firstRole.orgId;
  }

  return null;
}

/**
 * Set the active org cookie (used by org switcher).
 */
export async function setCurrentOrgId(orgId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}

/**
 * Execute a DB operation with RLS + audit context set for the given org and
 * user. Sets the PostgreSQL session variables that RLS policies and audit
 * triggers read (`app.current_org_id`, `app.current_user_id`, and the
 * user_email/user_name used by the audit trigger).
 *
 * #SEC-CTXLESS-ORG — robustness fix. The previous implementation issued four
 * `set_config(..., is_local => true)` statements through the shared `db` proxy
 * OUTSIDE any transaction. Each ran as its own implicit transaction, so the
 * `LOCAL` setting was reverted the instant that statement committed — by the
 * time `fn(db)` ran, none of the GUCs were set. Inside a `withAuth` request the
 * call happened to work anyway, because the `db` proxy is already routed to a
 * connection whose GUCs were pinned at session level by #406; but OUTSIDE a
 * request (any non-`withAuth` caller) it silently produced 0-row reads under
 * `grc_app`. We now delegate to the same proven reserved-connection mechanism:
 * `runWithRequestContext` reserves a connection, pins ALL of org/user/email/name
 * on it at session level, routes the `db` proxy to it for the duration of `fn`,
 * and releases it afterwards — correct both inside and outside a request, and a
 * no-op-safe under the dev/CI superuser (RLS bypassed).
 */
export async function withOrgContext<T>(
  orgId: string,
  session: Session | null,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  return runWithRequestContext(
    {
      orgId,
      userId: session?.user?.id ?? "",
      userEmail: session?.user?.email ?? "",
      userName: session?.user?.name ?? "",
    },
    // Inside runWithRequestContext the `db` proxy resolves to the reserved,
    // context-pinned connection, so every query `fn` makes is org/user-scoped.
    () => fn(db),
  );
}
