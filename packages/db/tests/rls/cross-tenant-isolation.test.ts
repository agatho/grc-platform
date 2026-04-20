import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import {
  createTestDb,
  createAppDb,
  setRlsContext,
  clearRlsContext,
  schema,
} from "../helpers";

/**
 * RLS Cross-Tenant Isolation Tests
 *
 * Verifies that:
 * - User A in Org A cannot see Org B data
 * - Without RLS context, non-superuser sees nothing
 * - With correct context, user sees only their org's data
 * - Superuser (grc) bypasses RLS for admin aggregation
 */

let adminDb: ReturnType<typeof createTestDb>;
let appDb: ReturnType<typeof createAppDb>;
let orgAId: string;
let orgBId: string;
let userAId: string;
let userBId: string;
const suffix = Date.now();

describe("RLS Cross-Tenant Isolation", () => {
  beforeAll(async () => {
    adminDb = createTestDb();
    // Create the grc_app role if it doesn't exist
    await adminDb.client.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grc_app') THEN
          CREATE ROLE grc_app LOGIN PASSWORD 'grc_app_dev_password';
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO grc_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO grc_app;
    `);

    appDb = createAppDb();

    // Create two test organizations
    const [orgA] = await adminDb.db
      .insert(schema.organization)
      .values({ name: "Test Org A (RLS)", type: "subsidiary", country: "DEU" })
      .returning({ id: schema.organization.id });
    const [orgB] = await adminDb.db
      .insert(schema.organization)
      .values({ name: "Test Org B (RLS)", type: "subsidiary", country: "AUT" })
      .returning({ id: schema.organization.id });
    orgAId = orgA.id;
    orgBId = orgB.id;

    // Create two test users (unique per run)
    const [uA] = await adminDb.db
      .insert(schema.user)
      .values({
        email: `rls-a-${suffix}@test.dev`,
        name: "User A",
        passwordHash: "x",
      })
      .returning({ id: schema.user.id });
    const [uB] = await adminDb.db
      .insert(schema.user)
      .values({
        email: `rls-b-${suffix}@test.dev`,
        name: "User B",
        passwordHash: "x",
      })
      .returning({ id: schema.user.id });
    userAId = uA.id;
    userBId = uB.id;

    // Assign roles
    await adminDb.db.insert(schema.userOrganizationRole).values([
      { userId: userAId, orgId: orgAId, role: "admin" },
      { userId: userBId, orgId: orgBId, role: "admin" },
    ]);
  });

  afterAll(async () => {
    // Disable triggers and rules for clean teardown
    await adminDb.client.unsafe(
      `ALTER TABLE user_organization_role DISABLE TRIGGER audit_trigger`,
    );
    await adminDb.client.unsafe(
      `ALTER TABLE organization DISABLE TRIGGER audit_trigger`,
    );
    await adminDb.client.unsafe(
      `ALTER TABLE "user" DISABLE TRIGGER audit_trigger`,
    );
    await adminDb.client.unsafe(
      `DROP RULE IF EXISTS audit_log_no_delete ON audit_log`,
    );

    // Generic teardown: drop rows from every tenant-scoped table before
    // removing the organization. Avoids FK-cascade order churn as new
    // tables are added.
    await adminDb.client.unsafe(
      `DO $$
       DECLARE
         t text;
       BEGIN
         FOR t IN
           SELECT DISTINCT table_name FROM information_schema.columns
           WHERE table_schema = 'public' AND column_name = 'org_id'
             AND table_name NOT IN ('organization')
         LOOP
           EXECUTE format('DELETE FROM %I WHERE org_id IN ($1, $2)', t)
             USING '${orgAId}'::uuid, '${orgBId}'::uuid;
         END LOOP;
       END $$;`,
    );
    await adminDb.client.unsafe(`
      DELETE FROM audit_log WHERE user_id IN ('${userAId}', '${userBId}');
      DELETE FROM "user" WHERE id IN ('${userAId}', '${userBId}');
      DELETE FROM organization WHERE id IN ('${orgAId}', '${orgBId}');
    `);

    await adminDb.client.unsafe(
      `CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING`,
    );
    await adminDb.client.unsafe(
      `ALTER TABLE user_organization_role ENABLE TRIGGER audit_trigger`,
    );
    await adminDb.client.unsafe(
      `ALTER TABLE organization ENABLE TRIGGER audit_trigger`,
    );
    await adminDb.client.unsafe(
      `ALTER TABLE "user" ENABLE TRIGGER audit_trigger`,
    );

    await appDb.client.end();
    await adminDb.client.end();
  });

  it("non-superuser sees 0 organizations without RLS context", async () => {
    const result =
      await appDb.client`SELECT count(*)::int AS cnt FROM organization`;
    expect(result[0].cnt).toBe(0);
  });

  it("non-superuser sees 0 user_organization_role without RLS context", async () => {
    const result =
      await appDb.client`SELECT count(*)::int AS cnt FROM user_organization_role`;
    expect(result[0].cnt).toBe(0);
  });

  it("user A with Org A context sees only Org A data", async () => {
    await setRlsContext(appDb.client, orgAId, userAId);
    const result = await appDb.client`SELECT id, name FROM organization`;
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(orgAId);
    expect(result[0].name).toBe("Test Org A (RLS)");
    await clearRlsContext(appDb.client);
  });

  it("user A with Org A context cannot see Org B data", async () => {
    await setRlsContext(appDb.client, orgAId, userAId);
    const result = await appDb.client`
      SELECT id FROM organization WHERE id = ${orgBId}
    `;
    expect(result).toHaveLength(0);
    await clearRlsContext(appDb.client);
  });

  it("user B with Org B context sees only Org B data", async () => {
    await setRlsContext(appDb.client, orgBId, userBId);
    const result = await appDb.client`SELECT id, name FROM organization`;
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(orgBId);
    await clearRlsContext(appDb.client);
  });

  it("user_organization_role is filtered by RLS context", async () => {
    await setRlsContext(appDb.client, orgAId, userAId);
    const roles =
      await appDb.client`SELECT user_id, role FROM user_organization_role`;
    expect(roles).toHaveLength(1);
    expect(roles[0].user_id).toBe(userAId);
    expect(roles[0].role).toBe("admin");
    await clearRlsContext(appDb.client);
  });

  it("switching context from Org A to Org B changes visible data", async () => {
    await setRlsContext(appDb.client, orgAId, userAId);
    const orgAResult =
      await appDb.client`SELECT count(*)::int AS cnt FROM organization`;
    expect(orgAResult[0].cnt).toBe(1);

    await setRlsContext(appDb.client, orgBId, userBId);
    const orgBResult = await appDb.client`SELECT id FROM organization`;
    expect(orgBResult).toHaveLength(1);
    expect(orgBResult[0].id).toBe(orgBId);
    await clearRlsContext(appDb.client);
  });

  it("superuser (grc) can see all organizations regardless of RLS", async () => {
    const result =
      await adminDb.client`SELECT count(*)::int AS cnt FROM organization`;
    expect(result[0].cnt).toBeGreaterThanOrEqual(2);
  });
});
