import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { hash } from "bcryptjs";
// The REAL login-path function (packages/auth). @grc/auth depends on @grc/db,
// so this direction is non-circular; vitest resolves the workspace symlink.
import { loadRoles } from "@grc/auth/providers";
import { createTestDb } from "../helpers";
import {
  db,
  organization,
  user,
  userOrganizationRole,
  requestClient,
  // The REAL fixed helper — the exact function BOTH loadRoles AND the NextAuth
  // `session` callback's fetchFreshRoles now delegate to. Imported, NOT rebuilt.
  withUserReadContext,
} from "../../src/index";

/**
 * #SEC-AUTH-BOOTSTRAP — regression test for the "fresh login shows roles: []"
 * production bug, driving the REAL code path under the REAL runtime role.
 *
 * ROOT CAUSE (empirically established, see fix PR)
 * ------------------------------------------------
 * Migration 0380 + loadRoles fixed the login (authorize) leg — a fresh POST
 * loads roles into the JWT. But the NextAuth `session` callback in
 * apps/web/src/auth.ts re-read roles via `fetchFreshRoles`, a CONTEXT-LESS
 * `db.select` on `user_organization_role`. `/api/auth/session` is served by
 * NextAuth's own handler (never wrapped by `withAuth`), so no request-scoped
 * RLS context exists. Under `grc_app` that read matches no policy and returns
 * 0 rows SILENTLY (not an error → the catch-fallback to the JWT copy never
 * fires) → `roles: []` overwrites the JWT roles → `currentOrgId` null → every
 * data endpoint answers 400 no-org-selected.
 *
 * THE FIX: both loadRoles (login) and fetchFreshRoles (session refresh) route
 * through the shared `withUserReadContext` helper, which reserves a dedicated
 * base-pool connection and sets `app.current_user_id` on THAT exact connection
 * so the migration-0380 `uor_self_read` policy applies deterministically.
 *
 * This suite runs under grc_app in CI (the "RLS isolation tests" step sets
 * APP_DATABASE_URL=grc_app so the global `db` proxy connects as grc_app and RLS
 * is live). It asserts:
 *   1. the naive context-less read is EMPTY (RLS genuinely enforced == the bug),
 *   2. the REAL `withUserReadContext` returns the user's own roles (session
 *      refresh now works),
 *   3. the REAL `loadRoles` returns them too (login path),
 *   4. the self-read is user-scoped (no foreign read).
 * Without the fix (context-less read) assertions 2/3 return 0 → the suite fails.
 */

const adminDb = createTestDb(); // superuser (grc) — seeds + tears down, bypasses RLS
const suffix = Date.now();

let orgId: string;
let userId: string;
let otherUserId: string;

describe("#SEC-AUTH-BOOTSTRAP session refresh under grc_app (real loadRoles + withUserReadContext)", () => {
  beforeAll(async () => {
    await adminDb.client.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grc_app') THEN
          CREATE ROLE grc_app LOGIN PASSWORD 'grc_app_dev_password';
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO grc_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
    `);

    const [org] = await adminDb.db
      .insert(organization)
      .values({
        name: `Session Refresh Org ${suffix}`,
        type: "subsidiary",
        country: "DEU",
      })
      .returning({ id: organization.id });
    orgId = org.id;

    const passwordHash = await hash("session-refresh-secret", 10);
    const [u] = await adminDb.db
      .insert(user)
      .values({
        email: `session-refresh-u-${suffix}@test.dev`,
        name: "Session Refresh User",
        passwordHash,
      })
      .returning({ id: user.id });
    userId = u.id;

    const [uOther] = await adminDb.db
      .insert(user)
      .values({
        email: `session-refresh-other-${suffix}@test.dev`,
        name: "Session Refresh Other",
        passwordHash: "x",
      })
      .returning({ id: user.id });
    otherUserId = uOther.id;

    await adminDb.db
      .insert(userOrganizationRole)
      .values({ userId, orgId, role: "risk_manager", lineOfDefense: "second" });
  });

  afterAll(async () => {
    await adminDb.client.unsafe(`SET session_replication_role = 'replica'`);
    await adminDb.client.unsafe(
      `DELETE FROM user_organization_role WHERE org_id = '${orgId}'`,
    );
    await adminDb.client.unsafe(
      `DELETE FROM "user" WHERE id IN ('${userId}', '${otherUserId}')`,
    );
    await adminDb.client.unsafe(
      `DELETE FROM organization WHERE id = '${orgId}'`,
    );
    await adminDb.client.unsafe(`SET session_replication_role = 'origin'`);

    await adminDb.client.end();
    await requestClient.end();
    await (
      db as unknown as { $client: { end: () => Promise<void> } }
    ).$client.end();
  });

  it("naive context-less read is EMPTY under grc_app (RLS live == the original bug)", async () => {
    const rows = await db
      .select({ orgId: userOrganizationRole.orgId })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.userId, userId),
          isNull(userOrganizationRole.deletedAt),
        ),
      );
    expect(rows).toHaveLength(0);
  });

  it("SESSION REFRESH: real withUserReadContext returns the user's own role(s)", async () => {
    const rows = await withUserReadContext(userId, (rdb) =>
      rdb
        .select({
          orgId: userOrganizationRole.orgId,
          role: userOrganizationRole.role,
        })
        .from(userOrganizationRole)
        .where(
          and(
            eq(userOrganizationRole.userId, userId),
            isNull(userOrganizationRole.deletedAt),
          ),
        ),
    );
    expect(rows.length).toBe(1);
    expect(rows[0].orgId).toBe(orgId);
    expect(rows[0].role).toBe("risk_manager");
  });

  it("LOGIN PATH: real loadRoles(userId) returns non-empty roles under grc_app", async () => {
    const roles = await loadRoles(userId);
    expect(roles.length).toBe(1);
    expect(roles[0].orgId).toBe(orgId);
    expect(roles[0].role).toBe("risk_manager");
  });

  it("self-read is user-scoped: another user's context never exposes U's rows", async () => {
    const rows = await withUserReadContext(otherUserId, (rdb) =>
      rdb
        .select({ orgId: userOrganizationRole.orgId })
        .from(userOrganizationRole)
        .where(eq(userOrganizationRole.userId, userId)),
    );
    expect(rows).toHaveLength(0);
  });
});
