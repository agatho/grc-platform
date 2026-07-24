import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql, eq } from "drizzle-orm";
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
 * #SEC-F01b — Request-scoped RLS context regression test.
 *
 * This is THE test that pins the bug fixed by request-context.ts: after F-01
 * the web app connects as the non-superuser `grc_app`, so RLS is enforced, but
 * the ~1.800 routes that query the GLOBAL `db` pool without a `withReadContext`
 * wrapper saw 0 rows because nothing set `app.current_org_id`. The previous CI
 * only exercised RLS through the test helpers' own clients + explicit
 * setRlsContext — it never proved that the SHARED `db` export a real route uses
 * gets a context. So the bug slipped through green CI.
 *
 * To be meaningful this test drives the exact same `db` proxy a route uses. It
 * is run with `APP_DATABASE_URL=grc_app` (see the CI "RLS isolation tests"
 * step) so `db` connects as the non-superuser and RLS is live. It proves BOTH
 * properties at once:
 *   1. WITH a request context (runWithRequestContext, Org A) a plain
 *      `db.select().from(risk)` returns Org A's row(s) and NOT Org B's, and is
 *      NOT empty  → reads work AND cross-tenant isolation holds.
 *   2. WITHOUT a context, the same query returns 0 rows → RLS is genuinely on
 *      (not accidentally bypassed).
 *
 * If `db` were superuser, or the proxy stopped delegating to the reserved
 * connection, or the GUC stopped being set, one of these assertions fails.
 */

const adminDb = createTestDb(); // superuser (grc) — seeds + verifies, bypasses RLS
const suffix = Date.now();

let orgAId: string;
let orgBId: string;
let userAId: string;
let riskAId: string;
let riskBId: string;

describe("#SEC-F01b request-scoped RLS context (global db proxy)", () => {
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
    `);

    const [orgA] = await adminDb.db
      .insert(organization)
      .values({
        name: `F01b Org A ${suffix}`,
        type: "subsidiary",
        country: "DEU",
      })
      .returning({ id: organization.id });
    const [orgB] = await adminDb.db
      .insert(organization)
      .values({
        name: `F01b Org B ${suffix}`,
        type: "subsidiary",
        country: "AUT",
      })
      .returning({ id: organization.id });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const [uA] = await adminDb.db
      .insert(user)
      .values({
        email: `f01b-a-${suffix}@test.dev`,
        name: "F01b User A",
        passwordHash: "x",
      })
      .returning({ id: user.id });
    userAId = uA.id;
    await adminDb.db
      .insert(userOrganizationRole)
      .values({ userId: userAId, orgId: orgAId, role: "admin" });

    const [rA] = await adminDb.db
      .insert(risk)
      .values({
        orgId: orgAId,
        title: `F01b Risk A ${suffix}`,
        riskCategory: "operational",
        riskSource: "erm",
      })
      .returning({ id: risk.id });
    const [rB] = await adminDb.db
      .insert(risk)
      .values({
        orgId: orgBId,
        title: `F01b Risk B ${suffix}`,
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
    await adminDb.client.unsafe(`DELETE FROM "user" WHERE id = '${userAId}'`);
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

  it("WITHOUT a request context, the global db sees 0 rows (RLS enforced)", async () => {
    const rows = await db
      .select({ id: risk.id })
      .from(risk)
      .where(sql`${risk.title} LIKE ${`F01b Risk % ${suffix}`}`);
    expect(rows).toHaveLength(0);
  });

  it("WITH Org A context, the global db returns ONLY Org A's risk (non-empty + isolated)", async () => {
    const rows = await runWithRequestContext(
      { orgId: orgAId, userId: userAId },
      async () => {
        return db
          .select({ id: risk.id, orgId: risk.orgId })
          .from(risk)
          .where(sql`${risk.title} LIKE ${`F01b Risk % ${suffix}`}`);
      },
    );
    // Reads WORK (not empty) …
    expect(rows.length).toBe(1);
    // … and are ISOLATED to Org A (never leak Org B).
    expect(rows[0].id).toBe(riskAId);
    expect(rows[0].orgId).toBe(orgAId);
    expect(rows.some((r) => r.id === riskBId)).toBe(false);
  });

  it("directly querying Org B's row under Org A context returns nothing", async () => {
    const rows = await runWithRequestContext(
      { orgId: orgAId, userId: userAId },
      async () =>
        db.select({ id: risk.id }).from(risk).where(eq(risk.id, riskBId)),
    );
    expect(rows).toHaveLength(0);
  });

  it("context is torn down after the wrapper: a follow-up context-less query is 0 rows again", async () => {
    // Proves releaseRequestContext returned the connection and the global db
    // fell back to the context-less base pool (no leaked org scope).
    const rows = await db
      .select({ id: risk.id })
      .from(risk)
      .where(sql`${risk.title} LIKE ${`F01b Risk % ${suffix}`}`);
    expect(rows).toHaveLength(0);
  });

  it("switching context to Org B returns ONLY Org B's risk (raw db.execute path)", async () => {
    const result = await runWithRequestContext(
      { orgId: orgBId, userId: userAId },
      async () =>
        db.execute(
          sql`SELECT id FROM risk WHERE title LIKE ${`F01b Risk % ${suffix}`}`,
        ),
    );
    const ids = (result as unknown as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toEqual([riskBId]);
  });
});
