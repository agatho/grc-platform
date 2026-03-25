// Auth context helpers (S1-03, S1-19)
// getCurrentOrgId reads the org cookie; withOrgContext sets RLS per request.

import { cookies } from "next/headers";
import { db, type Database } from "@grc/db";
import { sql } from "drizzle-orm";
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
  if (session?.user?.roles?.length) {
    return session.user.roles[0].orgId;
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
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}

/**
 * Execute a DB operation with RLS context set for the given org and user.
 * Sets PostgreSQL session variables that RLS policies and audit triggers read.
 */
export async function withOrgContext<T>(
  orgId: string,
  session: Session | null,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  const userId = session?.user?.id ?? "";
  const userEmail = session?.user?.email ?? "";
  const userName = session?.user?.name ?? "";

  await db.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
  await db.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
  await db.execute(sql`SELECT set_config('app.current_user_email', ${userEmail}, true)`);
  await db.execute(sql`SELECT set_config('app.current_user_name', ${userName}, true)`);

  return fn(db);
}
