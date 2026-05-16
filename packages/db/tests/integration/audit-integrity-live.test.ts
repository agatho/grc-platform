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
    // #WAVE10-CRITICAL-01: walk in chain_seq order (was: created_at, id).
    // chain_seq is strictly monotonic even within a single transaction,
    // so multiple audit_log rows from the same PUT chain correctly.
    const scope = `org:${orgId}`;
    const rows = await client<{ row_ok: boolean; chain_ok: boolean }[]>`
      WITH ordered AS (
        SELECT
          entry_hash AS stored_entry_hash,
          previous_hash AS stored_previous_hash,
          LAG(entry_hash) OVER (ORDER BY chain_seq) AS prev_row_entry_hash,
          CASE
            WHEN hash_version = 0 THEN entry_hash  -- v0 rows pass-through
            WHEN hash_version = 3 THEN compute_audit_hash_v3(
              previous_hash, org_id, user_id, entity_type, entity_id,
              action::text, changes, action_detail, metadata, created_at,
              previous_hash_scope
            )
            WHEN hash_version = 2 THEN compute_audit_hash_v2(
              previous_hash, org_id, user_id, entity_type, entity_id,
              action::text, changes, action_detail, metadata, created_at,
              previous_hash_scope
            )
            ELSE compute_audit_hash_v1(
              previous_hash, org_id, user_id, entity_type, entity_id,
              action::text, changes, created_at, previous_hash_scope
            )
          END AS recomputed_entry_hash,
          hash_version
        FROM audit_log
        WHERE previous_hash_scope = ${scope}
      )
      SELECT
        (hash_version = 0 OR stored_entry_hash = recomputed_entry_hash) AS row_ok,
        (hash_version = 0 OR COALESCE(stored_previous_hash, '') = COALESCE(prev_row_entry_hash, '')) AS chain_ok
      FROM ordered
    `;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.row_ok)).toBe(true);
    expect(rows.every((r) => r.chain_ok)).toBe(true);
  });

  it("keeps the chain healthy across 5 mutations that share a created_at", async () => {
    // #WAVE10 regression for the race condition Cowork QA Wave-9 found:
    // a PUT writes work_item + risk + search_index in one transaction,
    // they all get the same now()-derived created_at, and verify ordered
    // by (created_at, id) saw the chain as broken even though it was
    // written correctly. With chain_seq the verify walk matches the
    // INSERT order regardless of timestamp ties.
    //
    // We simulate the race by doing 5 same-transaction UPDATEs to a
    // single row — each fires the audit_trigger() so we get 5 audit_log
    // rows with identical now() values. After commit, the chain must
    // still verify clean.
    const scope = `org:${orgId}`;
    const auditCountBefore = await client<{ count: number }[]>`
      SELECT count(*)::int AS count FROM audit_log
      WHERE previous_hash_scope = ${scope}
    `;

    await client.begin(async (tx) => {
      // 5 rapid UPDATEs in one transaction — every UPDATE fires the
      // audit_trigger which writes one audit_log row. All 5 rows share
      // the transaction's now() value.
      for (let i = 0; i < 5; i++) {
        await tx`UPDATE organization SET name = ${"race-" + i} WHERE id = ${orgId}`;
      }
    });

    // After: there are 5 new audit_log rows with the same created_at.
    const auditCountAfter = await client<{ count: number }[]>`
      SELECT count(*)::int AS count FROM audit_log
      WHERE previous_hash_scope = ${scope}
    `;
    expect(auditCountAfter[0].count - auditCountBefore[0].count).toBe(5);

    // Walk in chain_seq order — no chain mismatches expected.
    const mismatches = await client<
      {
        row_ok: boolean;
        chain_ok: boolean;
      }[]
    >`
      WITH ordered AS (
        SELECT
          hash_version,
          entry_hash AS stored_entry_hash,
          previous_hash AS stored_previous_hash,
          LAG(entry_hash) OVER (ORDER BY chain_seq) AS prev_row_entry_hash,
          CASE
            WHEN hash_version = 3 THEN compute_audit_hash_v3(
              previous_hash, org_id, user_id, entity_type, entity_id,
              action::text, changes, action_detail, metadata, created_at,
              previous_hash_scope
            )
            WHEN hash_version = 2 THEN compute_audit_hash_v2(
              previous_hash, org_id, user_id, entity_type, entity_id,
              action::text, changes, action_detail, metadata, created_at,
              previous_hash_scope
            )
            ELSE compute_audit_hash_v1(
              previous_hash, org_id, user_id, entity_type, entity_id,
              action::text, changes, created_at, previous_hash_scope
            )
          END AS recomputed_entry_hash
        FROM audit_log
        WHERE previous_hash_scope = ${scope}
      )
      SELECT
        (hash_version = 0 OR stored_entry_hash = recomputed_entry_hash) AS row_ok,
        (hash_version = 0 OR COALESCE(stored_previous_hash, '') = COALESCE(prev_row_entry_hash, '')) AS chain_ok
      FROM ordered
    `;

    const rowBroken = mismatches.filter((r) => !r.row_ok).length;
    const chainBroken = mismatches.filter((r) => !r.chain_ok).length;
    expect(rowBroken).toBe(0);
    expect(chainBroken).toBe(0);
  });

  // #WAVE23.2: this test exercised the 0311+0312 retag/rehash logic in
  // a v1/v2 world. Wave-23.2 moved the trigger to v3 (TZ-invariant) and
  // 0328 wholesale-rehashes every row to v3 — after migrate-all runs in
  // CI, every audit_log row is v3 with a v3-formula hash. The inline
  // 0311 retag in this test then can't find any v1 or v2 matches and
  // tags every row v0, breaking the assertion that only the deliberately
  // injected row needs repair. The new TZ-invariance contract is pinned
  // by `audit-hash-v3-tz-invariance.test.ts`. Keeping this test as a
  // skipped historical reference — the underlying v0 oscillation it
  // exercised is no longer reachable.
  it.skip("rehashes a v0-tagged row and clears the broken-window warning [obsolete: superseded by W23.2 v3 rehash]", async () => {
    // #WAVE9 regression: end-to-end exercise of migration 0312's repair
    // path. Inject a row whose stored entry_hash matches NEITHER v1 nor
    // v2 (simulates the Wave-7 transition window), let 0311's observed
    // retag find it (it should land in hash_version=0), then run the
    // 0312 rehash logic and expect:
    //   - the row is now hash_version=2
    //   - its stored entry_hash matches the v2 recompute
    //   - a hash_repair audit_log entry exists for this org
    //
    // We rerun 0311+0312 inline rather than spawning psql so the test
    // stays in-process. Both migrations are idempotent.
    const scope = `org:${orgId}`;

    // Insert a row with a deliberately-wrong stored hash. Bypass the
    // trigger so we can control entry_hash directly.
    await client.unsafe(
      `ALTER TABLE organization DISABLE TRIGGER audit_trigger`,
    );
    try {
      await client`
        INSERT INTO audit_log (
          org_id, entity_type, entity_id, entity_title, action,
          previous_hash, entry_hash, previous_hash_scope, hash_version,
          created_at
        ) VALUES (
          ${orgId}, 'organization', ${orgId}, 'broken-window',
          'update', NULL,
          'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
          ${scope}, 1,
          now()
        )
      `;
    } finally {
      await client.unsafe(
        `ALTER TABLE organization ENABLE TRIGGER audit_trigger`,
      );
    }

    // Re-run 0311's observation logic — should retag the broken row v0.
    await client`
      WITH retagged AS (
        SELECT
          id,
          CASE
            WHEN entry_hash IS NULL THEN hash_version
            WHEN entry_hash = compute_audit_hash_v1(
              previous_hash, org_id, user_id, entity_type, entity_id,
              action::text, changes, created_at, previous_hash_scope
            ) THEN 1
            WHEN entry_hash = compute_audit_hash_v2(
              previous_hash, org_id, user_id, entity_type, entity_id,
              action::text, changes, action_detail, metadata, created_at,
              previous_hash_scope
            ) THEN 2
            ELSE 0
          END AS new_version
        FROM audit_log
        WHERE previous_hash_scope = ${scope}
      )
      UPDATE audit_log a
      SET hash_version = r.new_version
      FROM retagged r
      WHERE a.id = r.id
        AND a.hash_version IS DISTINCT FROM r.new_version
    `;

    const beforeRepair = await client<{ count: number }[]>`
      SELECT count(*)::int AS count FROM audit_log
      WHERE previous_hash_scope = ${scope} AND hash_version = 0
    `;
    expect(beforeRepair[0].count).toBe(1);

    // Run the rehash by invoking 0312's body (a DO block) directly via
    // psql. Done as a single client.unsafe() so PG processes the whole
    // PL/pgSQL block atomically. Also disables the append-only guard
    // around the call — same shape as 0312 in production.
    await client.unsafe(
      `ALTER TABLE audit_log DISABLE TRIGGER audit_log_tombstone_guard`,
    );
    await client.unsafe(`
      DO $$
      DECLARE
        v_org_id uuid;
        v_repair_id uuid;
        v_new_hash text;
        v_prev_hash text;
        v_now timestamptz := now();
        v_scope text;
        v_orgs uuid[];
        v_metadata jsonb;
      BEGIN
        SELECT array_agg(DISTINCT org_id) INTO v_orgs
        FROM audit_log WHERE hash_version = 0;
        IF v_orgs IS NULL THEN RETURN; END IF;
        FOREACH v_org_id IN ARRAY v_orgs
        LOOP
          v_scope := 'org:' || COALESCE(v_org_id::text, 'platform');
          SELECT jsonb_build_object('repaired_count', count(*))
            INTO v_metadata
            FROM audit_log WHERE hash_version = 0 AND org_id = v_org_id;
          FOR v_repair_id IN
            SELECT id FROM audit_log
            WHERE hash_version = 0 AND org_id = v_org_id
            ORDER BY created_at, id
          LOOP
            v_new_hash := compute_audit_hash_v2(
              (SELECT previous_hash FROM audit_log WHERE id = v_repair_id),
              v_org_id,
              (SELECT user_id FROM audit_log WHERE id = v_repair_id),
              (SELECT entity_type FROM audit_log WHERE id = v_repair_id),
              (SELECT entity_id FROM audit_log WHERE id = v_repair_id),
              (SELECT action::text FROM audit_log WHERE id = v_repair_id),
              (SELECT changes FROM audit_log WHERE id = v_repair_id),
              (SELECT action_detail FROM audit_log WHERE id = v_repair_id),
              (SELECT metadata FROM audit_log WHERE id = v_repair_id),
              (SELECT created_at FROM audit_log WHERE id = v_repair_id),
              v_scope
            );
            SELECT entry_hash INTO v_prev_hash
              FROM audit_log WHERE id = v_repair_id;
            UPDATE audit_log SET entry_hash = v_new_hash, hash_version = 2
              WHERE id = v_repair_id;
            UPDATE audit_log SET previous_hash = v_new_hash
              WHERE previous_hash = v_prev_hash
                AND previous_hash_scope = v_scope
                AND id <> v_repair_id;
          END LOOP;
          SELECT entry_hash INTO v_prev_hash FROM audit_log
            WHERE previous_hash_scope = v_scope AND hash_version = 2
            ORDER BY created_at DESC, id DESC LIMIT 1;
          v_new_hash := compute_audit_hash_v2(
            v_prev_hash, v_org_id, NULL, 'audit_log', NULL,
            'update', NULL, 'hash_repair', v_metadata, v_now, v_scope
          );
          INSERT INTO audit_log (
            org_id, user_id, user_email, user_name,
            entity_type, entity_id, entity_title,
            action, action_detail, changes, metadata,
            previous_hash, entry_hash, previous_hash_scope,
            hash_version, created_at
          ) VALUES (
            v_org_id, NULL, 'migration-0312@arctos', 'Migration 0312 (system)',
            'audit_log', NULL, 'Hash chain v0->v2 repair',
            'update', 'hash_repair', NULL, v_metadata,
            v_prev_hash, v_new_hash, v_scope, 2, v_now
          );
        END LOOP;
      END $$;
    `);
    await client.unsafe(
      `ALTER TABLE audit_log ENABLE TRIGGER audit_log_tombstone_guard`,
    );

    // After repair: no v0 rows, and the formerly-broken row has a new
    // entry_hash matching the v2 formula.
    const afterRepair = await client<{ count: number }[]>`
      SELECT count(*)::int AS count FROM audit_log
      WHERE previous_hash_scope = ${scope} AND hash_version = 0
    `;
    expect(afterRepair[0].count).toBe(0);

    const repairEntries = await client<{ count: number }[]>`
      SELECT count(*)::int AS count FROM audit_log
      WHERE previous_hash_scope = ${scope}
        AND action_detail = 'hash_repair'
    `;
    expect(repairEntries[0].count).toBe(1);

    // Idempotence: rerun the same rehash predicate scoped to this
    // test's tenant. Global v_count would be polluted by parallel
    // integration tests (audit-trigger, audit-chain-per-tenant) that
    // share the same DB process under singleFork — we only assert
    // the no-op for our own scope.
    const idempotenceCheck = await client<{ count: number }[]>`
      SELECT count(*)::int AS count FROM audit_log
      WHERE previous_hash_scope = ${scope} AND hash_version = 0
    `;
    expect(idempotenceCheck[0].count).toBe(0);
  });
});
