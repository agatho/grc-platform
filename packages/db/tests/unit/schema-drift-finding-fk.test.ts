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
import { createTestDb } from "../helpers";

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
  it("finding.control_id round-trips through a raw INSERT/SELECT", async () => {
    // Skip if no test org available — this test is destructive-light
    // and needs a tenant context.
    const orgRows = await dbCtx.client<{ id: string }[]>`
      SELECT id FROM organization LIMIT 1
    `;
    if (orgRows.length === 0) return; // empty DB; skip

    const orgId = orgRows[0].id;
    const ctlId = "00000000-0000-0000-0000-0000000000aa";

    // Insert a control + finding in the same tx.
    await dbCtx.client.unsafe(`
      INSERT INTO control (id, org_id, title, control_type, created_by, updated_by)
      VALUES ('${ctlId}', '${orgId}', 'A1-diag control', 'preventive', NULL, NULL)
      ON CONFLICT (id) DO NOTHING
    `);

    const fid = "00000000-0000-0000-0000-0000000000bb";
    await dbCtx.client.unsafe(`
      INSERT INTO finding (id, org_id, title, severity, source, control_id, created_by, updated_by)
      VALUES ('${fid}', '${orgId}', 'A1-diag finding', 'minor_nonconformity', 'audit', '${ctlId}', NULL, NULL)
      ON CONFLICT (id) DO NOTHING
    `);

    const rows = await dbCtx.client<{ control_id: string | null }[]>`
      SELECT control_id FROM finding WHERE id = ${fid}::uuid
    `;
    expect(rows.length).toBe(1);
    expect(
      rows[0].control_id,
      "finding.control_id is NULL after raw INSERT with control_id set — schema accepts the column but doesn't store it. Investigate triggers.",
    ).toBe(ctlId);

    // Cleanup.
    await dbCtx.client.unsafe(`DELETE FROM finding WHERE id = '${fid}'`);
    await dbCtx.client.unsafe(`DELETE FROM control WHERE id = '${ctlId}'`);
  });
});
