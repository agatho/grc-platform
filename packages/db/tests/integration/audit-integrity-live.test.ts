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
    // [ARCTOS-FULL-2026-08-31 / WP4 · S03-04] This test used to carry its
    // own copy of the verification CTE. Four such copies existed — this
    // one, the /integrity endpoint, the anchor gate and the DR drill
    // script — and they drifted: the anchor gate never got a
    // `hash_version = 3` branch, so it compared every live row's stored
    // hash with itself and reported "0 broken" for any input, including a
    // chain the endpoint reported as broken. Copying the check was the
    // defect. There is now one implementation, `audit_chain_check()`, and
    // this test calls it like every other caller does.
    const rows = await client<
      { row_ok: boolean; chain_ok: boolean; status: string }[]
    >`
      SELECT row_ok, chain_ok, status FROM audit_chain_check(${scope})
    `;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.row_ok)).toBe(true);
    expect(rows.every((r) => r.chain_ok)).toBe(true);
    expect(rows.every((r) => r.status === "ok")).toBe(true);
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
      SELECT row_ok, chain_ok FROM audit_chain_check(${scope})
    `;

    const rowBroken = mismatches.filter((r) => !r.row_ok).length;
    const chainBroken = mismatches.filter((r) => !r.chain_ok).length;
    expect(rowBroken).toBe(0);
    expect(chainBroken).toBe(0);
  });

  // [ARCTOS-FULL-2026-08-31 / WP11 · S11-18] REMOVED, not disabled.
  //
  // Until 2026-09-01 a ~180-line `it.skip("rehashes a v0-tagged row …
  // [obsolete: superseded by W23.2 v3 rehash]")` sat here with a comment
  // explaining that it can never pass again: Wave-23.2 moved the audit
  // trigger to the TZ-invariant v3 formula and migration 0328 rehashes every
  // row, so the inline 0311 retag the test performed tags everything v0 and
  // its central assertion cannot hold.
  //
  // A permanently disabled test with no path back is not a historical
  // reference, it is 180 lines that a reader has to understand before
  // discovering they are dead. The contract it used to guard — the v0
  // oscillation — is pinned by `audit-hash-v3-tz-invariance.test.ts`, which
  // runs. The old body is in git history at commit a8d1414f if anyone needs
  // to read it.
});
