import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../helpers";
import {
  db,
  organization,
  moduleDefinition,
  moduleConfig,
  requestClient,
  // The REAL new helper — the exact function the module-guard cache now uses.
  withOrgReadContext,
  // The delegation target that the fixed withOrgContext now routes through.
  runWithRequestContext,
} from "../../src/index";
// The REAL module gate + its cache. Imported by RELATIVE path (not via the
// `@grc/auth` package entry) on purpose: the package index re-exports `config.ts`
// which imports `next/headers`, unresolvable in the db-package test runner. The
// gate + cache themselves have no Next dependency.
import { requireModule } from "../../../auth/src/middleware/module-guard";
import * as moduleConfigCache from "../../../auth/src/cache/module-config-cache";

/**
 * #SEC-CTXLESS-ORG — regression test for the "requireModule 404s an enabled
 * module" bug, driving the REAL requireModule → moduleConfigCache path under the
 * REAL runtime role.
 *
 * ROOT CAUSE (empirically established)
 * ------------------------------------
 * `module_config` is org-scoped and RLS-protected; its policy casts
 * `current_setting('app.current_org_id')::uuid` with NO NULLIF guard. The
 * module-guard cache read ran through the shared `db` proxy with NO guaranteed
 * org context (requireModule runs early in the pipeline, before/independent of
 * the request-scoped context). Under `grc_app` that context-less read matches no
 * policy and returns 0 rows SILENTLY → `moduleConfigCache.get` returns null →
 * `requireModule` answers 404 for a module that is enabled in the DB.
 *
 * THE FIX: `moduleConfigCache.get` scopes its read through `withOrgReadContext`,
 * which pins `app.current_org_id` on a dedicated reserved connection so the
 * policy matches deterministically — regardless of the ambient request context.
 *
 * This suite runs under grc_app in CI (`test:rls` with APP_DATABASE_URL=grc_app
 * → the global `db` proxy, requestClient and withOrgReadContext all connect as
 * grc_app and RLS is live). It asserts:
 *   1. the naive context-less read is EMPTY (RLS genuinely enforced == the bug),
 *   2. the REAL withOrgReadContext returns the org's row,
 *   3. the REAL requireModule ALLOWS an enabled module (no bogus 404) — this is
 *      the assertion that FAILS without the fix and PASSES with it,
 *   4. requireModule still 404s a disabled / absent module,
 *   5. withOrgReadContext is org-isolated (no cross-org read),
 *   6. the fixed withOrgContext delegation (runWithRequestContext) yields
 *      org-scoped rows.
 */

const adminDb = createTestDb(); // superuser (grc) — seeds + tears down, bypasses RLS
const suffix = Date.now();

let orgId: string;
let otherOrgId: string;

describe("#SEC-CTXLESS-ORG module-guard under grc_app (real requireModule + withOrgReadContext)", () => {
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

    // Ensure the platform-wide module definition exists (global, no RLS). The
    // cache JOINs module_config→module_definition, so the definition row must
    // be present for the enabled path to return a row.
    await adminDb.db
      .insert(moduleDefinition)
      .values({
        moduleKey: "erm",
        displayNameDe: "Enterprise Risk Management",
        displayNameEn: "Enterprise Risk Management",
        navOrder: 1,
      })
      .onConflictDoNothing();

    const [org] = await adminDb.db
      .insert(organization)
      .values({
        name: `Ctxless Org ${suffix}`,
        type: "subsidiary",
        country: "DEU",
      })
      .returning({ id: organization.id });
    orgId = org.id;

    const [other] = await adminDb.db
      .insert(organization)
      .values({
        name: `Ctxless Other ${suffix}`,
        type: "subsidiary",
        country: "DEU",
      })
      .returning({ id: organization.id });
    otherOrgId = other.id;

    // Primary org: erm ENABLED. Other org: erm ENABLED too (for isolation test).
    await adminDb.db.insert(moduleConfig).values({
      orgId,
      moduleKey: "erm",
      uiStatus: "enabled",
      isDataActive: true,
    });
    await adminDb.db.insert(moduleConfig).values({
      orgId: otherOrgId,
      moduleKey: "erm",
      uiStatus: "enabled",
      isDataActive: true,
    });
  });

  afterAll(async () => {
    await adminDb.client.unsafe(`SET session_replication_role = 'replica'`);
    for (const id of [orgId, otherOrgId]) {
      await adminDb.client.unsafe(
        `DELETE FROM audit_log WHERE org_id = '${id}'`,
      );
      await adminDb.client.unsafe(
        `DELETE FROM module_config WHERE org_id = '${id}'`,
      );
      await adminDb.client.unsafe(
        `DELETE FROM organization WHERE id = '${id}'`,
      );
    }
    await adminDb.client.unsafe(`SET session_replication_role = 'origin'`);

    await adminDb.client.end();
    await requestClient.end();
    await (
      db as unknown as { $client: { end: () => Promise<void> } }
    ).$client.end();
  });

  it("naive context-less read is EMPTY under grc_app (RLS live == the original bug)", async () => {
    const rows = await db
      .select({ k: moduleConfig.moduleKey })
      .from(moduleConfig)
      .where(eq(moduleConfig.orgId, orgId));
    expect(rows).toHaveLength(0);
  });

  it("withOrgReadContext returns the org's module_config row under grc_app", async () => {
    const rows = await withOrgReadContext(orgId, (rdb) =>
      rdb
        .select({ k: moduleConfig.moduleKey, s: moduleConfig.uiStatus })
        .from(moduleConfig)
        .where(eq(moduleConfig.orgId, orgId)),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].k).toBe("erm");
    expect(rows[0].s).toBe("enabled");
  });

  it("requireModule ALLOWS an enabled module (no bogus 404) — fails without the fix", async () => {
    moduleConfigCache.clearAll();
    const res = await requireModule("erm", orgId, "GET");
    expect(res).toBeNull();
  });

  it("requireModule still 404s when the module is disabled", async () => {
    await adminDb.db
      .update(moduleConfig)
      .set({ uiStatus: "disabled" })
      .where(eq(moduleConfig.orgId, orgId));
    moduleConfigCache.clearAll();
    const res = await requireModule("erm", orgId, "GET");
    expect(res?.status).toBe(404);
    // restore enabled for any later reads
    await adminDb.db
      .update(moduleConfig)
      .set({ uiStatus: "enabled" })
      .where(eq(moduleConfig.orgId, orgId));
    moduleConfigCache.clearAll();
  });

  it("requireModule 404s when no config row exists for the org", async () => {
    // A brand-new org with no module_config at all.
    const [ghost] = await adminDb.db
      .insert(organization)
      .values({
        name: `Ctxless Ghost ${suffix}`,
        type: "subsidiary",
        country: "DEU",
      })
      .returning({ id: organization.id });
    moduleConfigCache.clearAll();
    const res = await requireModule("erm", ghost.id, "GET");
    expect(res?.status).toBe(404);
    await adminDb.client.unsafe(`SET session_replication_role = 'replica'`);
    await adminDb.client.unsafe(
      `DELETE FROM audit_log WHERE org_id = '${ghost.id}'`,
    );
    await adminDb.client.unsafe(
      `DELETE FROM organization WHERE id = '${ghost.id}'`,
    );
    await adminDb.client.unsafe(`SET session_replication_role = 'origin'`);
  });

  it("withOrgReadContext is org-isolated: other org's context never exposes org's rows", async () => {
    const rows = await withOrgReadContext(otherOrgId, (rdb) =>
      rdb
        .select({ org: moduleConfig.orgId })
        .from(moduleConfig)
        .where(eq(moduleConfig.moduleKey, "erm")),
    );
    // Under otherOrg's context only otherOrg's row is visible.
    expect(rows).toHaveLength(1);
    expect(rows[0].org).toBe(otherOrgId);
  });

  it("withOrgContext delegation (runWithRequestContext) yields org-scoped rows under grc_app", async () => {
    // withOrgContext now delegates entirely to runWithRequestContext; assert the
    // delegation target returns org-scoped data through the `db` proxy where a
    // context-less read would see nothing.
    const rows = await runWithRequestContext({ orgId, userId: "" }, () =>
      db
        .select({ k: moduleConfig.moduleKey })
        .from(moduleConfig)
        .where(eq(moduleConfig.orgId, orgId)),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].k).toBe("erm");
  });
});
