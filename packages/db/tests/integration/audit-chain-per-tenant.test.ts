import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schemaMod from "../../src/schema/platform";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://grc:grc_dev_password@localhost:5432/grc_platform";

function createSingleConnTestDb() {
  // Pool size 1 — every query in the test lands on the same connection,
  // so set_config(is_local=false) persists across queries.
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema: schemaMod });
  return { db, client };
}
const createTestDb = createSingleConnTestDb;

/**
 * Per-tenant audit chain tests (ADR-011 rev.2).
 *
 * The critical scenario the old chain failed on: two parallel writers
 * producing INSERTs against the same tenant. With a global chain, both
 * transactions saw the same "last committed" prev_hash and emitted two
 * siblings — the chain forked. With the new per-tenant chain + an
 * advisory_xact_lock scoped to the org, the second transaction blocks
 * until the first commits, then sees the correct prev_hash.
 *
 * These tests exercise that end-to-end with real DB transactions.
 */

let testDb: ReturnType<typeof createTestDb>;

describe("Per-tenant audit chain (ADR-011 rev.2)", () => {
  beforeAll(() => {
    testDb = createTestDb();
  });

  afterAll(async () => {
    await testDb.client.end();
  });

  it("chain entries share a previous_hash_scope within one tenant", async () => {
    const { client } = testDb;
    const now = Date.now();
    const orgName = `chain-test-a-${now}`;

    await client`SELECT set_config('app.current_user_id', '', false)`;
    await client`SELECT set_config('app.current_org_id', '', false)`;

    const [org] = await client<{ id: string }[]>`
      INSERT INTO organization (name, type, country, is_eu, is_data_controller)
      VALUES (${orgName}, 'subsidiary', 'DE', true, true)
      RETURNING id
    `;
    const orgId = org.id;

    // Two follow-up inserts in the same tenant to produce chain links
    await client`UPDATE organization SET name = ${orgName + "-v2"} WHERE id = ${orgId}`;
    await client`UPDATE organization SET name = ${orgName + "-v3"} WHERE id = ${orgId}`;

    const rows = await client<
      {
        previous_hash_scope: string;
        entry_hash: string;
        previous_hash: string | null;
      }[]
    >`
      SELECT previous_hash_scope, entry_hash, previous_hash
      FROM audit_log
      WHERE org_id = ${orgId}
      ORDER BY created_at ASC, id ASC
    `;

    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const r of rows) {
      expect(r.previous_hash_scope).toBe(`org:${orgId}`);
    }

    // Chain: each row's previous_hash is the prior row's entry_hash
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].previous_hash).toBe(rows[i - 1].entry_hash);
    }

    await client.unsafe(
      `ALTER TABLE organization DISABLE TRIGGER audit_trigger`,
    );
    await client.unsafe(
      `DROP RULE IF EXISTS audit_log_no_delete ON audit_log`,
    );
    await client`DELETE FROM audit_log WHERE org_id = ${orgId}`;
    await client`DELETE FROM organization WHERE id = ${orgId}`;
    await client.unsafe(
      `CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING`,
    );
    await client.unsafe(
      `ALTER TABLE organization ENABLE TRIGGER audit_trigger`,
    );
  });

  it("parallel inserts within one tenant produce a non-branching chain", async () => {
    const { client } = testDb;
    const now = Date.now();

    const [org] = await client<{ id: string }[]>`
      INSERT INTO organization (name, type, country, is_eu, is_data_controller)
      VALUES (${"parallel-test-" + now}, 'subsidiary', 'DE', true, true)
      RETURNING id
    `;
    const orgId = org.id;

    // Spawn 10 concurrent updates — with a global chain these would race
    // on prev_hash and fork. With the per-tenant lock they serialise.
    const updates = Array.from(
      { length: 10 },
      (_, i) =>
        client`UPDATE organization SET name = ${"parallel-" + now + "-" + i} WHERE id = ${orgId}`,
    );
    await Promise.all(updates);

    const rows = await client<
      { previous_hash: string | null; entry_hash: string }[]
    >`
      SELECT previous_hash, entry_hash
      FROM audit_log
      WHERE org_id = ${orgId}
      ORDER BY created_at ASC, id ASC
    `;

    // Creation + 10 updates = 11 rows
    expect(rows.length).toBe(11);

    // Every non-first row's previous_hash must equal the prior row's entry_hash.
    // This is the property that the old chain failed at.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].previous_hash).toBe(rows[i - 1].entry_hash);
    }

    // Uniqueness: no two rows should share an entry_hash
    const hashes = rows.map((r) => r.entry_hash);
    expect(new Set(hashes).size).toBe(hashes.length);

    await client.unsafe(
      `ALTER TABLE organization DISABLE TRIGGER audit_trigger`,
    );
    await client.unsafe(
      `DROP RULE IF EXISTS audit_log_no_delete ON audit_log`,
    );
    await client`DELETE FROM audit_log WHERE org_id = ${orgId}`;
    await client`DELETE FROM organization WHERE id = ${orgId}`;
    await client.unsafe(
      `CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING`,
    );
    await client.unsafe(
      `ALTER TABLE organization ENABLE TRIGGER audit_trigger`,
    );
  });

  it("two tenants' chains are independent (no cross-contamination)", async () => {
    const { client } = testDb;
    const now = Date.now();

    const [orgA] = await client<{ id: string }[]>`
      INSERT INTO organization (name, type, country, is_eu, is_data_controller)
      VALUES (${"tenant-a-" + now}, 'subsidiary', 'DE', true, true) RETURNING id
    `;
    const [orgB] = await client<{ id: string }[]>`
      INSERT INTO organization (name, type, country, is_eu, is_data_controller)
      VALUES (${"tenant-b-" + now}, 'subsidiary', 'DE', true, true) RETURNING id
    `;

    // Interleave updates across two tenants
    for (let i = 0; i < 5; i++) {
      await client`UPDATE organization SET name = ${"a-" + now + "-" + i} WHERE id = ${orgA.id}`;
      await client`UPDATE organization SET name = ${"b-" + now + "-" + i} WHERE id = ${orgB.id}`;
    }

    const rowsA = await client<
      {
        previous_hash: string | null;
        entry_hash: string;
        previous_hash_scope: string;
      }[]
    >`
      SELECT previous_hash, entry_hash, previous_hash_scope
      FROM audit_log
      WHERE org_id = ${orgA.id}
      ORDER BY created_at ASC, id ASC
    `;
    const rowsB = await client<
      {
        previous_hash: string | null;
        entry_hash: string;
        previous_hash_scope: string;
      }[]
    >`
      SELECT previous_hash, entry_hash, previous_hash_scope
      FROM audit_log
      WHERE org_id = ${orgB.id}
      ORDER BY created_at ASC, id ASC
    `;

    // A's chain is continuous within itself
    for (let i = 1; i < rowsA.length; i++) {
      expect(rowsA[i].previous_hash).toBe(rowsA[i - 1].entry_hash);
    }
    // B's chain is continuous within itself
    for (let i = 1; i < rowsB.length; i++) {
      expect(rowsB[i].previous_hash).toBe(rowsB[i - 1].entry_hash);
    }

    // Neither chain references a hash that only exists in the other tenant's chain
    const aHashes = new Set(rowsA.map((r) => r.entry_hash));
    const bHashes = new Set(rowsB.map((r) => r.entry_hash));
    for (const r of rowsA) {
      if (r.previous_hash) expect(bHashes.has(r.previous_hash)).toBe(false);
    }
    for (const r of rowsB) {
      if (r.previous_hash) expect(aHashes.has(r.previous_hash)).toBe(false);
    }

    // Scope labels are tenant-specific
    expect(rowsA.every((r) => r.previous_hash_scope === `org:${orgA.id}`)).toBe(
      true,
    );
    expect(rowsB.every((r) => r.previous_hash_scope === `org:${orgB.id}`)).toBe(
      true,
    );

    // Teardown: drop the append-only rule so cleanup can actually DELETE.
    // ALTER TABLE ... DISABLE RULE does not reliably bypass DO INSTEAD
    // NOTHING rules under all PG versions — dropping and recreating is the
    // guaranteed escape hatch for tests.
    await client.unsafe(
      `ALTER TABLE organization DISABLE TRIGGER audit_trigger`,
    );
    await client.unsafe(`DROP RULE IF EXISTS audit_log_no_delete ON audit_log`);
    await client`DELETE FROM audit_log WHERE org_id = ${orgA.id}`;
    await client`DELETE FROM audit_log WHERE org_id = ${orgB.id}`;
    await client`DELETE FROM organization WHERE id = ${orgA.id}`;
    await client`DELETE FROM organization WHERE id = ${orgB.id}`;
    await client.unsafe(
      `CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING`,
    );
    await client.unsafe(
      `ALTER TABLE organization ENABLE TRIGGER audit_trigger`,
    );
  });

  it("tombstone_audit_entry redacts PII without touching entry_hash", async () => {
    const { client } = testDb;
    const now = Date.now();

    const [org] = await client<{ id: string }[]>`
      INSERT INTO organization (name, type, country, is_eu, is_data_controller)
      VALUES (${"tombstone-" + now}, 'subsidiary', 'DE', true, true) RETURNING id
    `;

    await client`SELECT set_config('app.current_user_email', 'subject@example.com', false)`;
    await client`SELECT set_config('app.current_user_name', 'Test Subject', false)`;

    await client`UPDATE organization SET name = ${"tombstone-v2-" + now} WHERE id = ${org.id}`;

    const [row] = await client<{ id: string; entry_hash: string }[]>`
      SELECT id, entry_hash FROM audit_log WHERE org_id = ${org.id} ORDER BY created_at DESC LIMIT 1
    `;

    const originalHash = row.entry_hash;

    await client`SELECT tombstone_audit_entry(${row.id}::uuid, 'gdpr_art_17')`;

    const [after] = await client<
      {
        entry_hash: string;
        user_email: string;
        user_name: string;
        pii_tombstoned_at: Date | null;
        pii_tombstone_reason: string | null;
      }[]
    >`
      SELECT entry_hash, user_email, user_name, pii_tombstoned_at, pii_tombstone_reason
      FROM audit_log WHERE id = ${row.id}
    `;

    // entry_hash is preserved — tombstone does not rehash
    expect(after.entry_hash).toBe(originalHash);
    expect(String(after.user_email)).toMatch(/^__tombstoned__:/);
    expect(String(after.user_name)).toMatch(/^__tombstoned__:/);
    expect(after.pii_tombstoned_at).toBeTruthy();
    expect(after.pii_tombstone_reason).toBe("gdpr_art_17");

    // Tombstoning a second time must fail
    await expect(
      client`SELECT tombstone_audit_entry(${row.id}::uuid, 'double_tombstone')`,
    ).rejects.toThrow(/already tombstoned/);

    await client`SELECT set_config('app.current_user_email', '', false)`;
    await client`SELECT set_config('app.current_user_name', '', false)`;
    await client.unsafe(
      `ALTER TABLE organization DISABLE TRIGGER audit_trigger`,
    );
    await client.unsafe(`DROP RULE IF EXISTS audit_log_no_delete ON audit_log`);
    await client`DELETE FROM audit_log WHERE org_id = ${org.id}`;
    await client`DELETE FROM organization WHERE id = ${org.id}`;
    await client.unsafe(
      `CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING`,
    );
    await client.unsafe(
      `ALTER TABLE organization ENABLE TRIGGER audit_trigger`,
    );
  });
});
