import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql, and, eq, isNull } from "drizzle-orm";
import { hash } from "bcryptjs";
import { createTestDb } from "../helpers";
import {
  db,
  risk,
  organization,
  user,
  userOrganizationRole,
  requestClient,
  runWithRequestContext,
} from "../../src/index";

/**
 * #SEC-AUTH-BOOTSTRAP — full-chain regression test for the "fresh login is
 * broken under grc_app" production bug.
 *
 * The bug: since the web app connects as the non-superuser `grc_app` (RLS
 * enforced), every FRESH login returned 0 org-roles. `loadRoles(userId)` in
 * packages/auth/src/providers.ts read `user_organization_role` through the
 * global `db` pool WITHOUT any RLS context — and the table's org-scoped
 * policies match nothing pre-login (no `app.current_org_id` yet). Empty roles →
 * empty JWT → `getCurrentOrgId` null → every data endpoint 400 no-org-selected.
 *
 * The fix has two halves and THIS test drives both under grc_app (the real
 * runtime role — the CI "RLS isolation tests" step sets APP_DATABASE_URL=grc_app
 * so the global `db` proxy connects as grc_app and RLS is live):
 *
 *   1. AUTH BOOTSTRAP — mirrors providers.ts `withUserReadContext`/`loadRoles`
 *      EXACTLY: a `db.transaction` that `set_config('app.current_user_id', …)`
 *      before selecting the user's own `user_organization_role` rows. With the
 *      new permissive `uor_self_read` policy (migration 0380) this returns the
 *      role(s) even though no org context is set → a fresh login now loads
 *      roles. We also assert the two safety properties: WITHOUT the user
 *      context the same read is empty (RLS genuinely on), and setting a
 *      DIFFERENT user's id never exposes this user's rows (no foreign read).
 *
 *   2. DATA READS + ISOLATION — using the org id resolved from those roles,
 *      establish a request-scoped context (the same mechanism a real route
 *      uses) and query `risk`: it returns Org A's data (non-empty) and NOT
 *      Org B's. This proves the chain end-to-end: bootstrap loads roles →
 *      subsequent reads work → cross-tenant isolation holds — all as grc_app.
 *
 * If `db` were superuser, or migration 0380 were missing, or the bootstrap
 * stopped setting app.current_user_id, one of these assertions fails.
 */

const adminDb = createTestDb(); // superuser (grc) — seeds + verifies, bypasses RLS
const suffix = Date.now();

let orgAId: string;
let orgBId: string;
let userAId: string;
let otherUserId: string;
let riskAId: string;
let riskBId: string;

/**
 * Mirror of packages/auth/src/providers.ts `withUserReadContext` + `loadRoles`.
 * Kept as a local copy (not an import) because @grc/auth depends on @grc/db —
 * importing it here would create a circular package dependency. The SQL access
 * pattern is byte-for-byte the one the real login path runs.
 */
async function loadRolesLikeAuth(userId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_user_id', ${userId}, true)`,
    );
    return tx
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
      );
  });
}

describe("#SEC-AUTH-BOOTSTRAP fresh login under grc_app (loadRoles + reads)", () => {
  beforeAll(async () => {
    // Ensure grc_app exists with table grants (idempotent; CI also does this).
    await adminDb.client.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grc_app') THEN
          CREATE ROLE grc_app LOGIN PASSWORD 'grc_app_dev_password';
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO grc_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
      -- [ARCTOS-FULL-2026-08-31 / WP2 · S01-04, S01-08] Der pauschale GRANT
      -- oben erfasst auch die Auth.js-Token-Tabellen (deny-all seit Migration
      -- 0392) und die Materialized Views (kein security_invoker moeglich,
      -- Migration 0393). Ohne diesen REVOKE hebt er genau die Kontrollen
      -- wieder auf, die tenant-isolation-systemtest.test.ts prueft — ein
      -- spaeter laufender Test faende sie dann geoeffnet vor.
      REVOKE ALL ON public.session, public.account, public.verification_token
        FROM grc_app;
      DO $revoke_mv$ DECLARE r record; BEGIN
        FOR r IN SELECT c.relname FROM pg_class c
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relkind = 'm' LOOP
          EXECUTE format('REVOKE ALL ON public.%I FROM grc_app', r.relname);
        END LOOP;
      END $revoke_mv$;
    `);

    const [orgA] = await adminDb.db
      .insert(organization)
      .values({
        name: `Bootstrap Org A ${suffix}`,
        type: "subsidiary",
        country: "DEU",
      })
      .returning({ id: organization.id });
    const [orgB] = await adminDb.db
      .insert(organization)
      .values({
        name: `Bootstrap Org B ${suffix}`,
        type: "subsidiary",
        country: "AUT",
      })
      .returning({ id: organization.id });
    orgAId = orgA.id;
    orgBId = orgB.id;

    // User U — a real bcrypt password hash, like a provisioned login user.
    const passwordHash = await hash("bootstrap-secret", 10);
    const [uA] = await adminDb.db
      .insert(user)
      .values({
        email: `bootstrap-u-${suffix}@test.dev`,
        name: "Bootstrap User U",
        passwordHash,
      })
      .returning({ id: user.id });
    userAId = uA.id;

    // A second, unrelated user — used to prove no foreign read.
    const [uOther] = await adminDb.db
      .insert(user)
      .values({
        email: `bootstrap-other-${suffix}@test.dev`,
        name: "Bootstrap Other",
        passwordHash: "x",
      })
      .returning({ id: user.id });
    otherUserId = uOther.id;

    // U has exactly one role: admin in Org A.
    await adminDb.db
      .insert(userOrganizationRole)
      .values({ userId: userAId, orgId: orgAId, role: "admin" });

    const [rA] = await adminDb.db
      .insert(risk)
      .values({
        orgId: orgAId,
        title: `Bootstrap Risk A ${suffix}`,
        riskCategory: "operational",
        riskSource: "erm",
      })
      .returning({ id: risk.id });
    const [rB] = await adminDb.db
      .insert(risk)
      .values({
        orgId: orgBId,
        title: `Bootstrap Risk B ${suffix}`,
        riskCategory: "operational",
        riskSource: "erm",
      })
      .returning({ id: risk.id });
    riskAId = rA.id;
    riskBId = rB.id;
  });

  afterAll(async () => {
    // Teardown as superuser, skipping triggers/rules for a clean delete.
    await adminDb.client.unsafe(`SET session_replication_role = 'replica'`);
    await adminDb.client.unsafe(
      `DELETE FROM risk WHERE id IN ('${riskAId}', '${riskBId}')`,
    );
    await adminDb.client.unsafe(
      `DELETE FROM audit_log WHERE org_id IN ('${orgAId}', '${orgBId}')`,
    );
    await adminDb.client.unsafe(
      `DELETE FROM user_organization_role WHERE org_id IN ('${orgAId}', '${orgBId}')`,
    );
    await adminDb.client.unsafe(
      `DELETE FROM "user" WHERE id IN ('${userAId}', '${otherUserId}')`,
    );
    await adminDb.client.unsafe(
      `DELETE FROM organization WHERE id IN ('${orgAId}', '${orgBId}')`,
    );
    await adminDb.client.unsafe(`SET session_replication_role = 'origin'`);

    await adminDb.client.end();
    // Close the global proxy's pools so the vitest fork can exit cleanly.
    await requestClient.end();
    await (
      db as unknown as { $client: { end: () => Promise<void> } }
    ).$client.end();
  });

  it("WITHOUT any context, grc_app sees 0 role rows (RLS genuinely enforced)", async () => {
    const rows = await db
      .select({ orgId: userOrganizationRole.orgId })
      .from(userOrganizationRole)
      .where(eq(userOrganizationRole.userId, userAId));
    expect(rows).toHaveLength(0);
  });

  it("AUTH BOOTSTRAP: loadRoles under grc_app returns the user's own role (fresh login works)", async () => {
    const roles = await loadRolesLikeAuth(userAId);
    // The whole bug was this being empty. It must NOT be empty now.
    expect(roles.length).toBe(1);
    expect(roles[0].orgId).toBe(orgAId);
    expect(roles[0].role).toBe("admin");
  });

  it("self-read policy is user-scoped: a different user's context never exposes U's rows", async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_user_id', ${otherUserId}, true)`,
      );
      return tx
        .select({ orgId: userOrganizationRole.orgId })
        .from(userOrganizationRole)
        .where(eq(userOrganizationRole.userId, userAId));
    });
    expect(rows).toHaveLength(0);
  });

  it("DATA READS: with the resolved org context, reads return Org A's risk and NOT Org B's", async () => {
    const roles = await loadRolesLikeAuth(userAId);
    const resolvedOrgId = roles[0].orgId;

    const rows = await runWithRequestContext(
      { orgId: resolvedOrgId, userId: userAId },
      async () =>
        db
          .select({ id: risk.id, orgId: risk.orgId })
          .from(risk)
          .where(sql`${risk.title} LIKE ${`Bootstrap Risk % ${suffix}`}`),
    );
    // Reads WORK (not empty) …
    expect(rows.length).toBe(1);
    // … and are ISOLATED to Org A (Org B's risk never leaks).
    expect(rows[0].id).toBe(riskAId);
    expect(rows[0].orgId).toBe(orgAId);
    expect(rows.some((r) => r.id === riskBId)).toBe(false);
  });
});
