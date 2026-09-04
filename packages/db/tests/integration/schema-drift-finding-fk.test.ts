// Schema-Drift Diagnostic — Finding cross-module FK columns + org_branding
//
// #WAVE21-W22-A1A2: Wave-21 verification reported that POST /findings
// {controlId, auditId, riskId} returns 201 but the GET shows them as
// NULL — for the THIRD time. The route handler code is correct
// (apps/web/src/app/api/v1/findings/route.ts:122-141) and the Drizzle
// schema declares the columns (packages/db/src/schema/control.ts:328).
//
// Cowork QA's diagnosis: the production DB might be missing the
// columns because a migration didn't run, OR the deploy artifact
// pre-dates the route fix. This test runs against the live DB schema
// (via information_schema queries) and FAILS LOUDLY if either of:
//   1. `finding` table is missing any of the cross-module FK columns
//   2. `org_branding` table doesn't exist (Wave-21 A2 blocker)
//
// The test runs in the integration-test pool, so it executes against
// the actual seeded DB after migrations — catching schema drift that
// vitest unit tests can't see.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, requireRow, requireAt } from "../helpers";

describe("Schema drift — required FK columns + tables (Wave-21-W22-A1A2)", () => {
  let dbCtx: ReturnType<typeof createTestDb>;

  beforeAll(() => {
    dbCtx = createTestDb();
  });

  afterAll(async () => {
    await dbCtx.client.end();
  });

  it("finding.control_id column exists", async () => {
    const rows = await dbCtx.client<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'finding'
        AND column_name = 'control_id'
    `;
    expect(
      rows.length,
      "finding.control_id column missing — POST /findings will silently drop the FK. Run migrations.",
    ).toBe(1);
  });

  it("finding.control_test_id column exists", async () => {
    const rows = await dbCtx.client<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'finding'
        AND column_name = 'control_test_id'
    `;
    expect(rows.length).toBe(1);
  });

  it("finding.risk_id column exists", async () => {
    const rows = await dbCtx.client<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'finding'
        AND column_name = 'risk_id'
    `;
    expect(rows.length).toBe(1);
  });

  it("finding.audit_id column exists", async () => {
    const rows = await dbCtx.client<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'finding'
        AND column_name = 'audit_id'
    `;
    expect(rows.length).toBe(1);
  });

  it("org_branding table exists (Wave-21 A2 prerequisite)", async () => {
    const rows = await dbCtx.client<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'org_branding'
    `;
    expect(
      rows.length,
      "org_branding table missing — GET /admin/branding will 500 with 42P01. Run migration 0245 (or whichever creates this table).",
    ).toBe(1);
  });

  it("org_branding has the expected columns", async () => {
    const rows = await dbCtx.client<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'org_branding'
    `;
    const cols = new Set(rows.map((r) => r.column_name));
    const required = [
      "org_id",
      "primary_color",
      "secondary_color",
      "logo_path",
    ];
    for (const c of required) {
      expect(cols.has(c), `org_branding.${c} missing`).toBe(true);
    }
  });

  // Live behavior probe: insert a finding with controlId set, query
  // back, and confirm it persisted. If schema is correct but Drizzle
  // is dropping the field (the alternative QA hypothesis), this test
  // catches it cleanly — without depending on the API layer.
  //
  // [ARCTOS-FULL-2026-08-31 / Restdefekte · O-4] This probe used to be
  // "best-effort": it swallowed every error with a console.warn, and it
  // returned early when the database happened to hold no organization. The
  // error it was swallowing was not an environment quirk — it was the defect
  // O-4 names. The BEFORE-INSERT trigger `finding_auto_create_work_item()`
  // writes a `work_item` with `type_key = 'finding'`, and 'finding' was never
  // registered in `work_item_type`, so the FK failed and `POST /api/v1/findings`
  // answered 500 in production. Migration 0439 registers it; the swallow is
  // gone, and the test now brings its own organization instead of hoping one
  // exists. A green run of this test therefore means something.
  it("finding.control_id round-trips through a raw INSERT/SELECT", async () => {
    const suffix = Date.now();
    const org = requireRow(
      await dbCtx.client<{ id: string }[]>`
      INSERT INTO organization (name, type, country)
      VALUES (${`A1-diag Org ${suffix}`}, 'holding', 'DEU')
      RETURNING id
    `,
      "org",
    );
    const orgId = org.id;
    const ctlId = "00000000-0000-0000-0000-0000000000aa";
    const fid = "00000000-0000-0000-0000-0000000000bb";

    try {
      await dbCtx.client.unsafe(`
        INSERT INTO control (id, org_id, title, control_type, created_by, updated_by)
        VALUES ('${ctlId}', '${orgId}', 'A1-diag control', 'preventive', NULL, NULL)
        ON CONFLICT (id) DO NOTHING
      `);

      // Use 'observation' — guaranteed to exist in finding_severity
      // enum since the original 0011 migration.
      await dbCtx.client.unsafe(`
        INSERT INTO finding (id, org_id, title, severity, source, control_id, created_by, updated_by)
        VALUES ('${fid}', '${orgId}', 'A1-diag finding', 'observation', 'audit', '${ctlId}', NULL, NULL)
        ON CONFLICT (id) DO NOTHING
      `);

      const rows = await dbCtx.client<
        {
          control_id: string | null;
          work_item_id: string | null;
        }[]
      >`
        SELECT control_id, work_item_id FROM finding WHERE id = ${fid}::uuid
      `;
      expect(rows.length).toBe(1);
      expect(
        requireAt(rows, 0, "rows").control_id,
        "finding.control_id is NULL after raw INSERT — schema accepts the column but doesn't store it. Investigate triggers.",
      ).toBe(ctlId);

      // The trigger's work_item must exist and carry the catalog type — this
      // is the assertion the swallowed FK error used to hide.
      const wi = await dbCtx.client<{ type_key: string }[]>`
        SELECT type_key FROM work_item WHERE id = ${requireAt(rows, 0, "rows").work_item_id}::uuid
      `;
      expect(wi.map((r) => r.type_key)).toEqual(["finding"]);
    } finally {
      // Cleanup stays best-effort: a failed assertion above must surface as
      // the assertion, not as a follow-on cleanup error.
      try {
        await dbCtx.client.unsafe(
          `DELETE FROM work_item WHERE id IN (SELECT work_item_id FROM finding WHERE id = '${fid}')`,
        );
        await dbCtx.client.unsafe(`DELETE FROM finding WHERE id = '${fid}'`);
        await dbCtx.client.unsafe(`DELETE FROM control WHERE id = '${ctlId}'`);
        await dbCtx.client.unsafe(
          `DELETE FROM audit_log WHERE org_id = '${orgId}'`,
        );
        await dbCtx.client.unsafe(
          `DELETE FROM work_item WHERE org_id = '${orgId}'`,
        );
        await dbCtx.client.unsafe(
          `DELETE FROM organization WHERE id = '${orgId}'`,
        );
      } catch {
        /* ignore cleanup errors */
      }
    }
  });
});
