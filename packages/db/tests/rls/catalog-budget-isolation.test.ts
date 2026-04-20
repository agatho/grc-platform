import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestDb,
  createAppDb,
  setRlsContext,
  clearRlsContext,
  schema,
} from "../helpers";

/**
 * RLS Cross-Tenant Isolation Tests — Catalog Activation, Budget & Cost Entry
 *
 * Verifies that:
 * - Org B cannot see Org A's active catalog activations
 * - Org B cannot see Org A's budgets or cost entries
 * - Each org sees only its own data when RLS context is set
 *
 * RLS policy status (verified):
 * - org_active_catalog: RLS enabled + forced, policy "org_active_catalog_rls_org"
 * - grc_budget:         RLS enabled, policy "grc_budget_org_isolation"
 * - grc_cost_entry:     RLS enabled, policy "grc_cost_entry_org_isolation"
 */

let adminDb: ReturnType<typeof createTestDb>;
let appDb: ReturnType<typeof createAppDb>;
let orgAId: string;
let orgBId: string;
let userAId: string;
let userBId: string;
let catalogId: string;
let activeCatalogId: string;
let budgetId: string;
let costEntryId: string;
const suffix = Date.now();

describe("RLS Catalog, Budget & Cost Entry Isolation", () => {
  beforeAll(async () => {
    adminDb = createTestDb();

    // Ensure grc_app role exists
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
    const [orgA] = await adminDb.client`
      INSERT INTO organization (name, type, country)
      VALUES (${"RLS Catalog Org A " + suffix}, 'subsidiary', 'DEU')
      RETURNING id
    `;
    const [orgB] = await adminDb.client`
      INSERT INTO organization (name, type, country)
      VALUES (${"RLS Catalog Org B " + suffix}, 'subsidiary', 'AUT')
      RETURNING id
    `;
    orgAId = orgA.id;
    orgBId = orgB.id;

    // Create two test users
    const [uA] = await adminDb.client`
      INSERT INTO "user" (email, name, password_hash)
      VALUES (${"rls-cat-a-" + suffix + "@test.dev"}, 'Cat User A', 'x')
      RETURNING id
    `;
    const [uB] = await adminDb.client`
      INSERT INTO "user" (email, name, password_hash)
      VALUES (${"rls-cat-b-" + suffix + "@test.dev"}, 'Cat User B', 'x')
      RETURNING id
    `;
    userAId = uA.id;
    userBId = uB.id;

    // Assign roles
    await adminDb.client`
      INSERT INTO user_organization_role (user_id, org_id, role)
      VALUES (${userAId}, ${orgAId}, 'admin'), (${userBId}, ${orgBId}, 'admin')
    `;

    // Get a real catalog ID for FK reference
    const [cat] = await adminDb.client`SELECT id FROM catalog LIMIT 1`;
    catalogId = cat.id;

    // --- Seed test data for Org A ---

    // Activate a catalog for Org A
    const [ac] = await adminDb.client`
      INSERT INTO org_active_catalog (org_id, catalog_type, catalog_id, enforcement_level)
      VALUES (${orgAId}, 'control', ${catalogId}, 'mandatory')
      RETURNING id
    `;
    activeCatalogId = ac.id;

    // Create a budget for Org A
    const [b] = await adminDb.client`
      INSERT INTO grc_budget (org_id, year, total_amount, currency, status, name, created_by)
      VALUES (${orgAId}, 2026, 50000.00, 'EUR', 'draft', ${"RLS Test Budget " + suffix}, ${userAId})
      RETURNING id
    `;
    budgetId = b.id;

    // Create a cost entry for Org A
    const [ce] = await adminDb.client`
      INSERT INTO grc_cost_entry (org_id, entity_type, entity_id, cost_category, cost_type, amount, currency, period_start, period_end, created_by)
      VALUES (${orgAId}, 'budget', ${budgetId}, 'tools', 'actual', 12500.00, 'EUR', '2026-01-01', '2026-12-31', ${userAId})
      RETURNING id
    `;
    costEntryId = ce.id;
  });

  afterAll(async () => {
    // Disable audit triggers for clean teardown
    await adminDb.client.unsafe(
      `ALTER TABLE grc_cost_entry DISABLE TRIGGER audit_trigger`,
    );
    await adminDb.client.unsafe(
      `ALTER TABLE grc_budget DISABLE TRIGGER audit_trigger`,
    );
    await adminDb.client.unsafe(
      `ALTER TABLE org_active_catalog DISABLE TRIGGER audit_trigger`,
    );
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
    // tables are added. Explicit user-level cleanup comes after because
    // audit_log has a user_id FK too.
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

    // Re-enable triggers and rules
    await adminDb.client.unsafe(`SET session_replication_role = 'origin'`);
    await adminDb.client.unsafe(
      `ALTER TABLE grc_cost_entry ENABLE TRIGGER audit_trigger`,
    );
    await adminDb.client.unsafe(
      `ALTER TABLE grc_budget ENABLE TRIGGER audit_trigger`,
    );
    await adminDb.client.unsafe(
      `ALTER TABLE org_active_catalog ENABLE TRIGGER audit_trigger`,
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

  // ─── Catalog Activation Isolation ─────────────────────────────────────

  describe("Catalog Activation Isolation", () => {
    it("Org B cannot see Org A's active catalogs", async () => {
      await setRlsContext(appDb.client, orgBId, userBId);
      const result = await appDb.client`
        SELECT id FROM org_active_catalog WHERE id = ${activeCatalogId}
      `;
      expect(result).toHaveLength(0);
      await clearRlsContext(appDb.client);
    });

    it("Org B sees 0 active catalogs (none activated for Org B)", async () => {
      await setRlsContext(appDb.client, orgBId, userBId);
      const result = await appDb.client`
        SELECT count(*)::int AS cnt FROM org_active_catalog
      `;
      expect(result[0].cnt).toBe(0);
      await clearRlsContext(appDb.client);
    });

    it("Org A sees its own active catalog", async () => {
      await setRlsContext(appDb.client, orgAId, userAId);
      const result = await appDb.client`
        SELECT id, catalog_type, enforcement_level FROM org_active_catalog
      `;
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(activeCatalogId);
      expect(result[0].catalog_type).toBe("control");
      expect(result[0].enforcement_level).toBe("mandatory");
      await clearRlsContext(appDb.client);
    });

    it("without RLS context, non-superuser cannot access active catalogs", async () => {
      // RLS policies cast app.current_org_id to UUID; an empty/unset value
      // causes a cast error, which effectively denies access — correct behavior.
      await expect(
        appDb.client`SELECT count(*)::int AS cnt FROM org_active_catalog`,
      ).rejects.toThrow();
    });
  });

  // ─── Budget Isolation ─────────────────────────────────────────────────

  describe("Budget Isolation", () => {
    it("Org B cannot see Org A's budgets", async () => {
      await setRlsContext(appDb.client, orgBId, userBId);
      const result = await appDb.client`
        SELECT id FROM grc_budget WHERE id = ${budgetId}
      `;
      expect(result).toHaveLength(0);
      await clearRlsContext(appDb.client);
    });

    it("Org B sees 0 budgets", async () => {
      await setRlsContext(appDb.client, orgBId, userBId);
      const result = await appDb.client`
        SELECT count(*)::int AS cnt FROM grc_budget
      `;
      expect(result[0].cnt).toBe(0);
      await clearRlsContext(appDb.client);
    });

    it("Org A sees its own budget", async () => {
      await setRlsContext(appDb.client, orgAId, userAId);
      const result = await appDb.client`
        SELECT id, year, total_amount, status, name FROM grc_budget
      `;
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(budgetId);
      expect(result[0].year).toBe(2026);
      expect(result[0].status).toBe("draft");
      await clearRlsContext(appDb.client);
    });

    it("without RLS context, non-superuser cannot access budgets", async () => {
      await expect(
        appDb.client`SELECT count(*)::int AS cnt FROM grc_budget`,
      ).rejects.toThrow();
    });
  });

  // ─── Cost Entry Isolation ─────────────────────────────────────────────

  describe("Cost Entry Isolation", () => {
    it("Org B cannot see Org A's cost entries", async () => {
      await setRlsContext(appDb.client, orgBId, userBId);
      const result = await appDb.client`
        SELECT id FROM grc_cost_entry WHERE id = ${costEntryId}
      `;
      expect(result).toHaveLength(0);
      await clearRlsContext(appDb.client);
    });

    it("Org B sees 0 cost entries", async () => {
      await setRlsContext(appDb.client, orgBId, userBId);
      const result = await appDb.client`
        SELECT count(*)::int AS cnt FROM grc_cost_entry
      `;
      expect(result[0].cnt).toBe(0);
      await clearRlsContext(appDb.client);
    });

    it("Org A sees its own cost entry", async () => {
      await setRlsContext(appDb.client, orgAId, userAId);
      const result = await appDb.client`
        SELECT id, entity_type, cost_category, cost_type, amount FROM grc_cost_entry
      `;
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(costEntryId);
      expect(result[0].entity_type).toBe("budget");
      expect(result[0].cost_category).toBe("tools");
      expect(result[0].cost_type).toBe("actual");
      await clearRlsContext(appDb.client);
    });

    it("without RLS context, non-superuser cannot access cost entries", async () => {
      await expect(
        appDb.client`SELECT count(*)::int AS cnt FROM grc_cost_entry`,
      ).rejects.toThrow();
    });
  });

  // ─── Cross-table consistency ──────────────────────────────────────────

  describe("Cross-table consistency", () => {
    it("Org A sees all its data across catalog, budget, and cost tables", async () => {
      await setRlsContext(appDb.client, orgAId, userAId);

      const catalogs =
        await appDb.client`SELECT count(*)::int AS cnt FROM org_active_catalog`;
      const budgets =
        await appDb.client`SELECT count(*)::int AS cnt FROM grc_budget`;
      const costs =
        await appDb.client`SELECT count(*)::int AS cnt FROM grc_cost_entry`;

      expect(catalogs[0].cnt).toBe(1);
      expect(budgets[0].cnt).toBe(1);
      expect(costs[0].cnt).toBe(1);

      await clearRlsContext(appDb.client);
    });

    it("Org B sees nothing across catalog, budget, and cost tables", async () => {
      await setRlsContext(appDb.client, orgBId, userBId);

      const catalogs =
        await appDb.client`SELECT count(*)::int AS cnt FROM org_active_catalog`;
      const budgets =
        await appDb.client`SELECT count(*)::int AS cnt FROM grc_budget`;
      const costs =
        await appDb.client`SELECT count(*)::int AS cnt FROM grc_cost_entry`;

      expect(catalogs[0].cnt).toBe(0);
      expect(budgets[0].cnt).toBe(0);
      expect(costs[0].cnt).toBe(0);

      await clearRlsContext(appDb.client);
    });

    it("superuser (grc) bypasses RLS and sees all test data", async () => {
      const catalogs = await adminDb.client`
        SELECT count(*)::int AS cnt FROM org_active_catalog WHERE id = ${activeCatalogId}
      `;
      const budgets = await adminDb.client`
        SELECT count(*)::int AS cnt FROM grc_budget WHERE id = ${budgetId}
      `;
      const costs = await adminDb.client`
        SELECT count(*)::int AS cnt FROM grc_cost_entry WHERE id = ${costEntryId}
      `;

      expect(catalogs[0].cnt).toBe(1);
      expect(budgets[0].cnt).toBe(1);
      expect(costs[0].cnt).toBe(1);
    });
  });
});
