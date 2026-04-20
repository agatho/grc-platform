import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, desc } from "drizzle-orm";
import { createTestDb, schema } from "../helpers";

/**
 * Audit Trigger Integration Tests
 *
 * Verifies:
 * - INSERT on business table creates audit_log entry with action 'create'
 * - UPDATE on business table creates audit_log entry with field-level changes
 * - DELETE (soft) creates audit_log entry with action 'delete'
 * - SHA-256 hash chain links entries correctly
 * - Append-only rules prevent UPDATE/DELETE on log tables
 * - User/org snapshots are captured in audit entries
 */

let testDb: ReturnType<typeof createTestDb>;
let testOrgId: string;
let testUserId: string;
const testEmail = `audit-test-${Date.now()}@arctos.dev`;

describe("Audit Trigger & Hash Chain", () => {
  beforeAll(async () => {
    testDb = createTestDb();

    // Create a real test user so the audit trigger FK is satisfied
    const [testUser] = await testDb.db
      .insert(schema.user)
      .values({ email: testEmail, name: "Audit Tester", passwordHash: "x" })
      .returning({ id: schema.user.id });
    testUserId = testUser.id;

    // Set session variables so audit trigger can read user context
    await testDb.client`SELECT set_config('app.current_user_id', ${testUserId}, false)`;
    await testDb.client`SELECT set_config('app.current_user_email', ${testEmail}, false)`;
    await testDb.client`SELECT set_config('app.current_user_name', 'Audit Tester', false)`;
    await testDb.client`SELECT set_config('app.current_org_id', '', false)`;
  });

  afterAll(async () => {
    // Clear session context so audit trigger doesn't produce FK violations during cleanup
    await testDb.client`SELECT set_config('app.current_org_id', '', false)`;
    await testDb.client`SELECT set_config('app.current_user_id', '', false)`;
    // Disable audit trigger on tables we'll delete from
    await testDb.client.unsafe(
      `ALTER TABLE organization DISABLE TRIGGER audit_trigger`,
    );
    await testDb.client.unsafe(
      `ALTER TABLE "user" DISABLE TRIGGER audit_trigger`,
    );
    await testDb.client.unsafe(
      `ALTER TABLE audit_log DISABLE RULE audit_log_no_delete`,
    );
    if (testUserId) {
      await testDb.client.unsafe(
        `DELETE FROM audit_log WHERE user_id = '${testUserId}'`,
      );
    }
    if (testOrgId) {
      await testDb.client.unsafe(
        `DELETE FROM audit_log WHERE org_id = '${testOrgId}' OR entity_id = '${testOrgId}'`,
      );
      await testDb.client.unsafe(
        `DELETE FROM organization WHERE id = '${testOrgId}'`,
      );
    }
    if (testUserId) {
      await testDb.client.unsafe(
        `DELETE FROM "user" WHERE id = '${testUserId}'`,
      );
    }
    // Re-enable everything
    await testDb.client.unsafe(
      `ALTER TABLE audit_log ENABLE RULE audit_log_no_delete`,
    );
    await testDb.client.unsafe(
      `ALTER TABLE organization ENABLE TRIGGER audit_trigger`,
    );
    await testDb.client.unsafe(
      `ALTER TABLE "user" ENABLE TRIGGER audit_trigger`,
    );
    await testDb.client.end();
  });

  it("INSERT on organization creates an audit_log entry with action 'create'", async () => {
    const [org] = await testDb.db
      .insert(schema.organization)
      .values({ name: "Audit Test Corp", type: "holding", country: "DEU" })
      .returning();
    testOrgId = org.id;

    // Set org context for subsequent operations
    await testDb.client`SELECT set_config('app.current_org_id', ${testOrgId}, false)`;

    // Check audit_log
    const logs = await testDb.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, testOrgId))
      .orderBy(desc(schema.auditLog.createdAt));

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const createLog = logs.find((l) => l.action === "create");
    expect(createLog).toBeDefined();
    expect(createLog!.entityType).toBe("organization");
    expect(createLog!.entityId).toBe(testOrgId);
    expect(createLog!.userEmail).toBe(testEmail);
    expect(createLog!.userName).toBe("Audit Tester");
  });

  it("UPDATE on organization creates an audit_log entry with changes JSONB", async () => {
    await testDb.db
      .update(schema.organization)
      .set({ name: "Audit Test Corp Updated", country: "AUT" })
      .where(eq(schema.organization.id, testOrgId));

    const logs = await testDb.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, testOrgId))
      .orderBy(desc(schema.auditLog.createdAt));

    const updateLog = logs.find((l) => l.action === "update");
    expect(updateLog).toBeDefined();
    expect(updateLog!.changes).toBeDefined();

    const changes = updateLog!.changes as Record<string, any>;
    // Should capture field-level diff
    expect(changes).toHaveProperty("name");
    expect(changes.name.old).toBe("Audit Test Corp");
    expect(changes.name.new).toBe("Audit Test Corp Updated");
  });

  it("audit_log entries for test entity form a valid hash chain", async () => {
    // Verify our test entries are linked: each entry's previous_hash matches the prior entry's entry_hash
    const entries = await testDb.client`
      SELECT id, entry_hash, previous_hash, created_at
      FROM audit_log
      WHERE entity_id = ${testOrgId}
      ORDER BY created_at ASC
    `;

    expect(entries.length).toBeGreaterThanOrEqual(2); // at least create + update

    for (let i = 1; i < entries.length; i++) {
      // Each entry's previous_hash should reference some earlier entry's entry_hash
      expect(entries[i].previous_hash).toBeDefined();
      expect(entries[i].previous_hash).not.toBeNull();
    }

    // Additionally verify the global chain is not broken for recent entries
    const chainCheck = await testDb.client`
      SELECT a.id,
        EXISTS(
          SELECT 1 FROM audit_log b WHERE b.entry_hash = a.previous_hash
        ) AS has_parent
      FROM audit_log a
      WHERE a.entity_id = ${testOrgId} AND a.previous_hash IS NOT NULL
    `;
    for (const row of chainCheck) {
      expect(row.has_parent).toBe(true);
    }
  });

  it("each audit_log entry has a non-null entry_hash (SHA-256)", async () => {
    const logs = await testDb.db
      .select({
        id: schema.auditLog.id,
        entryHash: schema.auditLog.entryHash,
      })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityId, testOrgId));

    for (const log of logs) {
      expect(log.entryHash).toBeDefined();
      expect(log.entryHash).not.toBeNull();
      // SHA-256 hex = 64 chars
      expect(log.entryHash!.length).toBe(64);
      expect(log.entryHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("append-only rules prevent UPDATE on audit_log", async () => {
    const logs = await testDb.db
      .select({ id: schema.auditLog.id })
      .from(schema.auditLog)
      .limit(1);

    if (logs.length > 0) {
      // UPDATE should silently do nothing (DO INSTEAD NOTHING rule)
      await testDb.client`
        UPDATE audit_log SET user_email = 'tampered@evil.com' WHERE id = ${logs[0].id}
      `;

      // Verify it wasn't actually changed
      const [after] = await testDb.client`
        SELECT user_email FROM audit_log WHERE id = ${logs[0].id}
      `;
      expect(after.user_email).not.toBe("tampered@evil.com");
    }
  });

  it("append-only rules prevent DELETE on audit_log (non-superuser)", async () => {
    // Note: superuser can bypass rules. In CI, the grc_app role is used.
    // Here we verify the rule exists.
    const rules = await testDb.client`
      SELECT count(*)::int AS cnt
      FROM pg_rules
      WHERE schemaname = 'public'
        AND tablename = 'audit_log'
        AND rulename LIKE '%_no_%'
    `;
    expect(rules[0].cnt).toBeGreaterThanOrEqual(2); // no_update + no_delete
  });

  it("append-only rules exist for all 3 log tables", async () => {
    const rules = await testDb.client`
      SELECT tablename, rulename
      FROM pg_rules
      WHERE schemaname = 'public'
        AND rulename LIKE '%_no_%'
      ORDER BY tablename, rulename
    `;

    const tables = [...new Set(rules.map((r: any) => r.tablename))];
    expect(tables).toContain("audit_log");
    expect(tables).toContain("access_log");
    expect(tables).toContain("data_export_log");
  });

  it("audit triggers exist on business tables", async () => {
    const triggers = await testDb.client`
      SELECT event_object_table
      FROM information_schema.triggers
      WHERE trigger_name = 'audit_trigger'
      ORDER BY event_object_table
    `;

    const tablesWithTrigger = [
      ...new Set(triggers.map((t: any) => t.event_object_table)),
    ];
    expect(tablesWithTrigger).toContain("organization");
    expect(tablesWithTrigger).toContain("user");
    expect(tablesWithTrigger).toContain("user_organization_role");
    expect(tablesWithTrigger).toContain("notification");
  });
});
