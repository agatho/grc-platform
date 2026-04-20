import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://grc:grc_dev_password@localhost:5432/grc_platform";

let client: ReturnType<typeof postgres>;
let orgId: string;

describe("Audit integrity endpoint logic (live DB)", () => {
  beforeAll(async () => {
    client = postgres(DATABASE_URL, { max: 1 });
    const [org] = await client<{ id: string }[]>`
      INSERT INTO organization (name, type, country, is_eu, is_data_controller)
      VALUES ('integrity-live-test', 'subsidiary', 'DE', true, true)
      RETURNING id
    `;
    orgId = org.id;
    await client`UPDATE organization SET name = 'v2' WHERE id = ${orgId}`;
    await client`UPDATE organization SET name = 'v3' WHERE id = ${orgId}`;
    await client`UPDATE organization SET name = 'v4' WHERE id = ${orgId}`;
  });

  afterAll(async () => {
    await client.unsafe(
      `ALTER TABLE organization DISABLE TRIGGER audit_trigger`,
    );
    await client.unsafe(`SET session_replication_role = 'replica'`);
    await client`DELETE FROM audit_log WHERE org_id = ${orgId}`;
    await client`DELETE FROM organization WHERE id = ${orgId}`;
    await client.unsafe(`SET session_replication_role = 'origin'`);
    await client.unsafe(
      `ALTER TABLE organization ENABLE TRIGGER audit_trigger`,
    );
    await client.end();
  });

  it("reports healthy=true for a freshly written per-tenant chain", async () => {
    const scope = `org:${orgId}`;
    const rows = await client<{ row_ok: boolean; chain_ok: boolean }[]>`
      WITH ordered AS (
        SELECT
          entry_hash AS stored_entry_hash,
          previous_hash AS stored_previous_hash,
          LAG(entry_hash) OVER (ORDER BY created_at, id) AS prev_row_entry_hash,
          encode(digest(
            COALESCE(previous_hash, '0') || '|' ||
            COALESCE(org_id::text, '') || '|' ||
            COALESCE(user_id::text, '') || '|' ||
            entity_type || '|' ||
            COALESCE(entity_id::text, '') || '|' ||
            action::text || '|' ||
            COALESCE(changes::text, '') || '|' ||
            created_at::text || '|' ||
            previous_hash_scope,
            'sha256'
          ), 'hex') AS recomputed_entry_hash
        FROM audit_log
        WHERE previous_hash_scope = ${scope}
      )
      SELECT
        (stored_entry_hash = recomputed_entry_hash) AS row_ok,
        (COALESCE(stored_previous_hash, '') = COALESCE(prev_row_entry_hash, '')) AS chain_ok
      FROM ordered
    `;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.row_ok)).toBe(true);
    expect(rows.every((r) => r.chain_ok)).toBe(true);
  });
});
