// Wave-24-A1: Findings cross-module FK persistence — end-to-end round-trip
//
// Why this file lives in apps/web/__tests__/integration/ (not in the
// existing packages/db/tests/integration/ pool):
//
// The db-side test (schema-drift-finding-fk.test.ts) already covers
// "schema accepts the column but doesn't store it" via raw INSERT. What
// is NOT covered, and what Wave-22 actually saw, is the FULL ROUTE
// PATH: Drizzle insert through `tx.insert(finding).values({...})` with
// the route's `withAuditContext` session vars set, then a read-side
// `tx.select(...).from(finding)` projection that also runs through
// Drizzle. If a column-name mapping or compiled-schema mismatch hides
// inside the apps/web bundle (H2 in docs/audits/wave-24-a1-hypothesis.md),
// the db-package raw test can pass while the route still drops FKs.
//
// Setup expectations (for a future operator unblocking this):
//   1. A reachable Postgres at $DATABASE_URL with migrations applied
//      (`npm --workspace @grc/db run db:migrate-all`).
//   2. At least one row in `organization`, `user`, `control`,
//      `control_test`, `risk`, `audit` — the test reuses them; it
//      does NOT create catalog/seed data.
//   3. Vitest config that loads this file from the integration pool.
//      `apps/web/vitest.config.ts` currently exposes only the unit
//      pool — see "TO UNBLOCK" comment at the bottom.
//
// Until those three exist, the suite is marked `describe.skip` so CI
// stays green. Removing `.skip` is a one-line change.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

// Lazy import to keep this file parseable when the workspace alias
// isn't wired up in the integration pool (e.g. running with
// `vitest run apps/web/src/__tests__/integration/...` outside the
// monorepo root).
async function loadSchema() {
  const mod = await import("@grc/db");
  return {
    finding: mod.finding,
    workItem: mod.workItem,
    organization: mod.organization,
  };
}

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://grc:grc_dev_password@localhost:5432/grc_platform";

// Marked `describe.skip` — see header comment.
// TO UNBLOCK:
//   1. Ensure $DATABASE_URL points at a migrated Postgres.
//   2. Ensure at least one `organization` and one `user` exist.
//   3. Provide at least one row in each of `control`, `control_test`,
//      `risk`, `audit` (the test reuses the first of each).
//   4. Change `describe.skip` to `describe` and re-run.
describe.skip("Findings cross-module FK persistence (Wave-24-A1)", () => {
  let client: ReturnType<typeof postgres>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let orgId: string;
  let userId: string;
  let controlId: string | null = null;
  let controlTestId: string | null = null;
  let riskId: string | null = null;
  let auditId: string | null = null;

  beforeAll(async () => {
    client = postgres(DATABASE_URL, { max: 1 });
    db = drizzle(client);

    // Pull existing seeded ids. We use raw client queries to avoid
    // taking a dependency on every domain schema being importable here.
    const [org] = await client<{ id: string }[]>`
      SELECT id FROM organization LIMIT 1
    `;
    const [usr] = await client<{ id: string }[]>`
      SELECT id FROM "user" LIMIT 1
    `;
    if (!org || !usr) {
      throw new Error(
        "[Wave-24-A1] No organization or user in the test DB. Run seed first.",
      );
    }
    orgId = org.id;
    userId = usr.id;

    const [ctl] = await client<{ id: string }[]>`
      SELECT id FROM control WHERE org_id = ${orgId} LIMIT 1
    `;
    controlId = ctl?.id ?? null;

    const [ct] = await client<{ id: string }[]>`
      SELECT id FROM control_test WHERE org_id = ${orgId} LIMIT 1
    `;
    controlTestId = ct?.id ?? null;

    const [rsk] = await client<{ id: string }[]>`
      SELECT id FROM risk WHERE org_id = ${orgId} LIMIT 1
    `;
    riskId = rsk?.id ?? null;

    const [aud] = await client<{ id: string }[]>`
      SELECT id FROM audit WHERE org_id = ${orgId} LIMIT 1
    `;
    auditId = aud?.id ?? null;
  });

  afterAll(async () => {
    if (client) {
      await client`DELETE FROM finding WHERE title LIKE 'WAVE24-A1-%'`;
      await client.end();
    }
  });

  // Helper: replicate the route's withAuditContext setup inside a tx so
  // that RLS sees the org/user. The route function isn't directly
  // exported with a swappable tx; replicating the session-config
  // pattern keeps the test honest to what the route actually does.
  async function insertFindingViaDrizzle(
    fkOverrides: {
      controlId?: string;
      controlTestId?: string;
      riskId?: string;
      auditId?: string;
    },
    label: string,
  ): Promise<{ id: string; row: Record<string, unknown> }> {
    const { finding, workItem } = await loadSchema();
    return db.transaction(async (tx: typeof db) => {
      await tx.execute(
        sql`SELECT set_config('app.current_org_id', ${orgId}, true)`,
      );
      await tx.execute(
        sql`SELECT set_config('app.current_user_id', ${userId}, true)`,
      );
      await tx.execute(
        sql`SELECT set_config('app.current_user_email', 'wave24-a1@arctos.dev', true)`,
      );
      await tx.execute(
        sql`SELECT set_config('app.current_user_name', 'Wave-24-A1 Test', true)`,
      );

      const [wi] = await tx
        .insert(workItem)
        .values({
          orgId,
          typeKey: "finding",
          name: label,
          status: "draft",
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const [row] = await tx
        .insert(finding)
        .values({
          orgId,
          workItemId: wi.id,
          title: label,
          severity: "observation",
          source: "audit",
          controlId: fkOverrides.controlId,
          controlTestId: fkOverrides.controlTestId,
          riskId: fkOverrides.riskId,
          auditId: fkOverrides.auditId,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      return { id: row.id as string, row: row as Record<string, unknown> };
    });
  }

  // Helper: read back outside the insert tx (mimics the prod symptom
  // — POST returns OK, then a follow-up GET reveals the FK is null).
  async function readbackFindingFks(
    id: string,
  ): Promise<{
    control_id: string | null;
    control_test_id: string | null;
    risk_id: string | null;
    audit_id: string | null;
  }> {
    await client`SELECT set_config('app.current_org_id', ${orgId}, false)`;
    const [row] = await client<
      {
        control_id: string | null;
        control_test_id: string | null;
        risk_id: string | null;
        audit_id: string | null;
      }[]
    >`
      SELECT control_id, control_test_id, risk_id, audit_id
      FROM finding WHERE id = ${id}::uuid
    `;
    return row;
  }

  it("controlId round-trips through Drizzle insert + raw select", async () => {
    if (!controlId) {
      console.warn("[Wave-24-A1] No control row to link — skipping controlId");
      return;
    }
    const { id, row } = await insertFindingViaDrizzle(
      { controlId },
      "WAVE24-A1-CONTROL",
    );
    // The Drizzle returning() row MUST already have controlId (Wave-23
    // verifier covers this in-route — we re-assert here as a regression
    // anchor).
    expect(
      row.controlId,
      "Drizzle returning() row dropped controlId — H2 (stale compiled schema)",
    ).toBe(controlId);

    const persisted = await readbackFindingFks(id);
    expect(
      persisted.control_id,
      "finding.control_id was null on read-back — POST persisted differently than expected (H4 trigger / H7 prepared-stmt cache).",
    ).toBe(controlId);
  });

  it("auditId round-trips", async () => {
    if (!auditId) {
      console.warn("[Wave-24-A1] No audit row to link — skipping auditId");
      return;
    }
    const { id, row } = await insertFindingViaDrizzle(
      { auditId },
      "WAVE24-A1-AUDIT",
    );
    expect(row.auditId).toBe(auditId);

    const persisted = await readbackFindingFks(id);
    expect(persisted.audit_id).toBe(auditId);
  });

  it("riskId round-trips", async () => {
    if (!riskId) {
      console.warn("[Wave-24-A1] No risk row to link — skipping riskId");
      return;
    }
    const { id, row } = await insertFindingViaDrizzle(
      { riskId },
      "WAVE24-A1-RISK",
    );
    expect(row.riskId).toBe(riskId);

    const persisted = await readbackFindingFks(id);
    expect(persisted.risk_id).toBe(riskId);
  });

  it("controlTestId round-trips", async () => {
    if (!controlTestId) {
      console.warn(
        "[Wave-24-A1] No control_test row to link — skipping controlTestId",
      );
      return;
    }
    const { id, row } = await insertFindingViaDrizzle(
      { controlTestId },
      "WAVE24-A1-CT",
    );
    expect(row.controlTestId).toBe(controlTestId);

    const persisted = await readbackFindingFks(id);
    expect(persisted.control_test_id).toBe(controlTestId);
  });

  it("all four FKs round-trip when sent together", async () => {
    if (!controlId || !controlTestId || !riskId || !auditId) {
      console.warn(
        "[Wave-24-A1] One or more linked entities missing — skipping combo",
      );
      return;
    }
    const { id, row } = await insertFindingViaDrizzle(
      { controlId, controlTestId, riskId, auditId },
      "WAVE24-A1-ALL",
    );
    expect(row.controlId).toBe(controlId);
    expect(row.controlTestId).toBe(controlTestId);
    expect(row.riskId).toBe(riskId);
    expect(row.auditId).toBe(auditId);

    const persisted = await readbackFindingFks(id);
    expect(persisted.control_id).toBe(controlId);
    expect(persisted.control_test_id).toBe(controlTestId);
    expect(persisted.risk_id).toBe(riskId);
    expect(persisted.audit_id).toBe(auditId);
  });
});
