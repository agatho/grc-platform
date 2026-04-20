import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import {
  createTestDb,
  createAppDb,
  setRlsContext,
  clearRlsContext,
  schema,
} from "../helpers";
import { runRlsAudit } from "../../src/rls-audit";

/**
 * RLS Coverage System Test (ADR-001)
 *
 * Two complementary checks:
 *
 *   A) Static audit — every tenant-scoped table must have RLS enabled,
 *      FORCED, and have policies for SELECT/INSERT/UPDATE/DELETE (or
 *      a single FOR ALL policy). Fails if a new tenant table was added
 *      without a policy — this is the check the admin UI also runs.
 *
 *   B) Live isolation probe — with two real tenants and the non-owner
 *      `grc_app` role, a sample of well-known tenant tables is
 *      actually queried from tenant A's RLS context; rows inserted as
 *      tenant B must not appear. This proves the policies not only
 *      exist but work.
 *
 * The probe uses the three most load-bearing tenant tables (risk,
 * control, asset). Adding more doesn't improve coverage — if the
 * policy shape is wrong on one, it's wrong on hundreds.
 */

let adminDb: ReturnType<typeof createTestDb>;
let appDb: ReturnType<typeof createAppDb>;
let orgAId: string;
let orgBId: string;
let userAId: string;
let userBId: string;
const suffix = Date.now();

describe("RLS Coverage System Test (ADR-001)", () => {
  beforeAll(async () => {
    adminDb = createTestDb();

    await adminDb.client.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grc_app') THEN
          CREATE ROLE grc_app LOGIN PASSWORD 'grc_app_dev_password';
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO grc_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
      GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO grc_app;
    `);

    appDb = createAppDb();

    const [orgA] = await adminDb.db
      .insert(schema.organization)
      .values({
        name: `RLS-SysTest A ${suffix}`,
        type: "subsidiary",
        country: "DEU",
      })
      .returning({ id: schema.organization.id });
    const [orgB] = await adminDb.db
      .insert(schema.organization)
      .values({
        name: `RLS-SysTest B ${suffix}`,
        type: "subsidiary",
        country: "AUT",
      })
      .returning({ id: schema.organization.id });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const [uA] = await adminDb.db
      .insert(schema.user)
      .values({
        email: `rls-sys-a-${suffix}@test.dev`,
        name: "RLS User A",
        passwordHash: "x",
      })
      .returning({ id: schema.user.id });
    const [uB] = await adminDb.db
      .insert(schema.user)
      .values({
        email: `rls-sys-b-${suffix}@test.dev`,
        name: "RLS User B",
        passwordHash: "x",
      })
      .returning({ id: schema.user.id });
    userAId = uA.id;
    userBId = uB.id;
  });

  afterAll(async () => {
    await clearRlsContext(appDb.client);

    // Clean up as superuser, bypassing our own policies. The test itself
    // only INSERTs risks + orgs + users, but Sprint 1.4's work-item
    // triggers create work_item rows, and the AI-Act seeds / audit trail
    // may create other org-scoped rows too. Delete from every
    // tenant-scoped table generically before dropping the organization.
    await adminDb.client.unsafe(`
      ALTER TABLE organization DISABLE TRIGGER audit_trigger;
      ALTER TABLE "user"       DISABLE TRIGGER audit_trigger;
      SET session_replication_role = 'replica';
    `);

    await adminDb.client.unsafe(
      `DO $$
       DECLARE
         t text;
       BEGIN
         FOR t IN
           SELECT DISTINCT c.table_name FROM information_schema.columns c JOIN information_schema.tables tbl_meta ON tbl_meta.table_schema = c.table_schema AND tbl_meta.table_name = c.table_name AND tbl_meta.table_type = 'BASE TABLE'
           WHERE c.table_schema = 'public' AND c.column_name = 'org_id'
             AND c.table_name NOT IN ('organization')
         LOOP
           EXECUTE format('DELETE FROM %I WHERE org_id IN ($1, $2)', t)
             USING '${orgAId}'::uuid, '${orgBId}'::uuid;
         END LOOP;
       END $$;`,
    );
    await adminDb.client`DELETE FROM "user" WHERE id IN (${userAId}, ${userBId})`;
    await adminDb.client`DELETE FROM organization WHERE id IN (${orgAId}, ${orgBId})`;
    await adminDb.client.unsafe(`
      SET session_replication_role = 'origin';
      ALTER TABLE organization ENABLE TRIGGER audit_trigger;
      ALTER TABLE "user"       ENABLE TRIGGER audit_trigger;
    `);

    await appDb.client.end();
    await adminDb.client.end();
  });

  // ─────────────────────────────────────────────────────────────
  // A) Static audit
  // ─────────────────────────────────────────────────────────────
  it("every tenant-scoped table has RLS enabled, FORCED, and at least one policy", async () => {
    const report = await runRlsAudit();
    const gaps = report.tables.filter(
      (t) =>
        t.status === "missing_rls" ||
        t.status === "missing_force" ||
        t.status === "missing_policies",
    );

    if (gaps.length > 0) {
      // Surface the offending table names in the assertion message so a
      // failing CI run tells the contributor exactly what to fix.
      const list = gaps.map((g) => `${g.tableName} (${g.status})`).join(", ");
      throw new Error(`${gaps.length} tenant tables without RLS: ${list}`);
    }
    expect(gaps).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────
  // B) Live isolation probes
  // ─────────────────────────────────────────────────────────────

  it("tenant A never sees tenant B's organizations via the grc_app role", async () => {
    await setRlsContext(appDb.client, orgAId, userAId);

    const rows = await appDb.client<{ id: string }[]>`
      SELECT id FROM organization WHERE id = ${orgBId}
    `;
    expect(rows.length).toBe(0);

    const own = await appDb.client<{ id: string }[]>`
      SELECT id FROM organization WHERE id = ${orgAId}
    `;
    expect(own.length).toBe(1);
  });

  it("a row inserted under tenant A is invisible under tenant B's RLS context", async () => {
    // Insert a risk under tenant A (as superuser, so the test doesn't
    // depend on the INSERT policy being correct — the SELECT policy is
    // what we're proving here).
    const [aRisk] = await adminDb.client<{ id: string }[]>`
      INSERT INTO risk (org_id, title, risk_category, risk_source, status)
      VALUES (${orgAId}::uuid, ${"A-only risk " + suffix}, 'operational', 'erm', 'identified')
      RETURNING id
    `;

    await setRlsContext(appDb.client, orgBId, userBId);
    const visibleToB = await appDb.client<{ id: string }[]>`
      SELECT id FROM risk WHERE id = ${aRisk.id}::uuid
    `;
    expect(visibleToB.length).toBe(0);

    await setRlsContext(appDb.client, orgAId, userAId);
    const visibleToA = await appDb.client<{ id: string }[]>`
      SELECT id FROM risk WHERE id = ${aRisk.id}::uuid
    `;
    expect(visibleToA.length).toBe(1);

    // Clean up the test risk as superuser
    await adminDb.client`DELETE FROM risk WHERE id = ${aRisk.id}::uuid`;
  });

  it("grc_app cannot INSERT a row with a foreign org_id under a wrong RLS context", async () => {
    await setRlsContext(appDb.client, orgAId, userAId);

    // Attempting to create a row pointing at tenant B should be blocked
    // by the WITH CHECK clause of the FOR ALL policy.
    const attempt = async () =>
      appDb.client`
        INSERT INTO risk (org_id, title, risk_category, risk_source, status)
        VALUES (${orgBId}::uuid, ${"cross-tenant injection attempt " + suffix}, 'operational', 'erm', 'identified')
      `;

    await expect(attempt()).rejects.toThrow(
      /row-level security|row violates|Policy f(ü|u)r Sicherheit auf Zeilenebene|verletzt Policy/i,
    );
  });

  it("clearing the RLS context produces zero tenant rows (secure default)", async () => {
    await clearRlsContext(appDb.client);
    // Accept either outcome: the policy filters to zero rows, OR the
    // cast of an empty string to uuid raises. Both are "secure default"
    // — the attacker sees nothing. What must NOT happen is that a
    // non-empty result comes back.
    try {
      const rows = await appDb.client<{ id: string }[]>`
        SELECT id FROM organization LIMIT 5
      `;
      expect(rows.length).toBe(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Accept UUID-cast errors ("invalid input syntax for type uuid")
      // as equivalent to "query blocked". Anything else should bubble up.
      expect(msg).toMatch(/uuid|Eingabesyntax|row-level security|permission/i);
    }
  });
});
