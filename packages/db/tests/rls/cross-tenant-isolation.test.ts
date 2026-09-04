import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import {
  createTestDb,
  createAppDb,
  setRlsContext,
  clearRlsContext,
  schema,
  requireRow,
  requireAt,
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

    appDb = createAppDb();

    // Create two test organizations
    const orgA = requireRow(
      await adminDb.db
        .insert(schema.organization)
        .values({
          name: "Test Org A (RLS)",
          type: "subsidiary",
          country: "DEU",
        })
        .returning({ id: schema.organization.id }),
      "orgA",
    );
    const orgB = requireRow(
      await adminDb.db
        .insert(schema.organization)
        .values({
          name: "Test Org B (RLS)",
          type: "subsidiary",
          country: "AUT",
        })
        .returning({ id: schema.organization.id }),
      "orgB",
    );
    orgAId = orgA.id;
    orgBId = orgB.id;

    // Create two test users (unique per run)
    const uA = requireRow(
      await adminDb.db
        .insert(schema.user)
        .values({
          email: `rls-a-${suffix}@test.dev`,
          name: "User A",
          passwordHash: "x",
        })
        .returning({ id: schema.user.id }),
      "uA",
    );
    const uB = requireRow(
      await adminDb.db
        .insert(schema.user)
        .values({
          email: `rls-b-${suffix}@test.dev`,
          name: "User B",
          passwordHash: "x",
        })
        .returning({ id: schema.user.id }),
      "uB",
    );
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
    await adminDb.client.unsafe(`SET session_replication_role = 'replica'`);

    // Generic teardown: drop rows from every tenant-scoped table before
    // removing the organization. Avoids FK-cascade order churn as new
    // tables are added.
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
    await adminDb.client.unsafe(`
      DELETE FROM audit_log WHERE user_id IN ('${userAId}', '${userBId}');
      DELETE FROM "user" WHERE id IN ('${userAId}', '${userBId}');
      DELETE FROM organization WHERE id IN ('${orgAId}', '${orgBId}');
    `);

    await adminDb.client.unsafe(`SET session_replication_role = 'origin'`);
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
    expect(requireAt(result, 0, "result").cnt).toBe(0);
  });

  it("non-superuser sees 0 user_organization_role without RLS context", async () => {
    const result =
      await appDb.client`SELECT count(*)::int AS cnt FROM user_organization_role`;
    expect(requireAt(result, 0, "result").cnt).toBe(0);
  });

  it("user A with Org A context sees only Org A data", async () => {
    await setRlsContext(appDb.client, orgAId, userAId);
    const result = await appDb.client`SELECT id, name FROM organization`;
    expect(result).toHaveLength(1);
    expect(requireAt(result, 0, "result").id).toBe(orgAId);
    expect(requireAt(result, 0, "result").name).toBe("Test Org A (RLS)");
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
    expect(requireAt(result, 0, "result").id).toBe(orgBId);
    await clearRlsContext(appDb.client);
  });

  it("user_organization_role is filtered by RLS context", async () => {
    await setRlsContext(appDb.client, orgAId, userAId);
    const roles =
      await appDb.client`SELECT user_id, role FROM user_organization_role`;
    expect(roles).toHaveLength(1);
    expect(requireAt(roles, 0, "roles").user_id).toBe(userAId);
    expect(requireAt(roles, 0, "roles").role).toBe("admin");
    await clearRlsContext(appDb.client);
  });

  it("switching context from Org A to Org B changes visible data", async () => {
    await setRlsContext(appDb.client, orgAId, userAId);
    const orgAResult =
      await appDb.client`SELECT count(*)::int AS cnt FROM organization`;
    expect(requireAt(orgAResult, 0, "orgAResult").cnt).toBe(1);

    await setRlsContext(appDb.client, orgBId, userBId);
    const orgBResult = await appDb.client`SELECT id FROM organization`;
    expect(orgBResult).toHaveLength(1);
    expect(requireAt(orgBResult, 0, "orgBResult").id).toBe(orgBId);
    await clearRlsContext(appDb.client);
  });

  it("superuser (grc) can see all organizations regardless of RLS", async () => {
    const result =
      await adminDb.client`SELECT count(*)::int AS cnt FROM organization`;
    expect(requireAt(result, 0, "result").cnt).toBeGreaterThanOrEqual(2);
  });
});
