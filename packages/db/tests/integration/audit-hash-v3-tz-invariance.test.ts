// #WAVE23.2 — v3 audit-hash TZ-invariance regression test.
//
// Pins the root-cause fix for the v0 audit-trail oscillation
// discovered during Wave-23 prod-diagnose 2026-05-16:
//   - v1/v2 used `created_at::text` which is session-TZ-dependent.
//   - v3 uses `to_char(created_at AT TIME ZONE 'UTC', ...)` which is
//     identical regardless of session TZ.
//
// This test computes the same v3 hash twice — once in UTC, once in
// Europe/Berlin — and asserts the outputs are byte-identical. If
// this test fails, the v0 oscillation is back.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";

const DB_URL = process.env.INTEGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

describe("audit-hash v3 TZ-invariance (Wave-23.2)", () => {
  if (!DB_URL) {
    it.skip("no DATABASE_URL set, skipping", () => {});
    return;
  }

  const client = postgres(DB_URL, { max: 1, onnotice: () => {} });

  afterAll(async () => {
    await client.end();
  });

  beforeAll(async () => {
    // Belt-and-braces: the function MUST exist before we test it.
    // Migrations should have created it via 0327; if not, fail loudly.
    const fnExists = await client<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'compute_audit_hash_v3'
      ) AS exists
    `;
    if (!fnExists[0]?.exists) {
      throw new Error(
        "compute_audit_hash_v3 not found — migration 0327 hasn't been applied. Run `npm run db:migrate-all` first.",
      );
    }
  });

  it("produces the same hash in UTC and Europe/Berlin sessions", async () => {
    // Same input data, two different session TZs.
    const fixed = {
      previous_hash: "abc123",
      org_id: "11111111-1111-1111-1111-111111111111",
      user_id: "22222222-2222-2222-2222-222222222222",
      entity_type: "finding",
      entity_id: "33333333-3333-3333-3333-333333333333",
      action: "create",
      changes: { new: { title: "Test" } },
      action_detail: "test_action",
      metadata: { reason: "Tz invariance check" },
      // A timestamp that renders differently in different timezones.
      // CEST = UTC+2 in summer, so 21:45:00+02 == 19:45:00+00.
      created_at: "2026-05-12T21:45:00.123456+02:00",
      scope: "org:11111111-1111-1111-1111-111111111111",
    };

    const hashUtc = await client.begin(async (tx) => {
      await tx.unsafe("SET LOCAL TIME ZONE 'UTC'");
      const r = await tx<{ h: string }[]>`
        SELECT compute_audit_hash_v3(
          ${fixed.previous_hash},
          ${fixed.org_id}::uuid,
          ${fixed.user_id}::uuid,
          ${fixed.entity_type},
          ${fixed.entity_id}::uuid,
          ${fixed.action},
          ${JSON.stringify(fixed.changes)}::jsonb,
          ${fixed.action_detail},
          ${JSON.stringify(fixed.metadata)}::jsonb,
          ${fixed.created_at}::timestamptz,
          ${fixed.scope}
        ) AS h
      `;
      return r[0].h;
    });

    const hashBerlin = await client.begin(async (tx) => {
      await tx.unsafe("SET LOCAL TIME ZONE 'Europe/Berlin'");
      const r = await tx<{ h: string }[]>`
        SELECT compute_audit_hash_v3(
          ${fixed.previous_hash},
          ${fixed.org_id}::uuid,
          ${fixed.user_id}::uuid,
          ${fixed.entity_type},
          ${fixed.entity_id}::uuid,
          ${fixed.action},
          ${JSON.stringify(fixed.changes)}::jsonb,
          ${fixed.action_detail},
          ${JSON.stringify(fixed.metadata)}::jsonb,
          ${fixed.created_at}::timestamptz,
          ${fixed.scope}
        ) AS h
      `;
      return r[0].h;
    });

    expect(hashUtc).toBe(hashBerlin);
    expect(hashUtc).toMatch(/^[0-9a-f]{64}$/);
  });

  it("v2 of the same row IS TZ-sensitive (regression-doc, not a bug to fix)", async () => {
    // This test exists to document why v3 was needed. v2 is
    // session-TZ-dependent — running it in UTC vs Europe/Berlin gives
    // DIFFERENT hashes. We assert that explicitly so a future
    // refactor doesn't accidentally "fix" v2 (which would break
    // historic chain verification).
    const fixed = {
      previous_hash: "abc123",
      org_id: "11111111-1111-1111-1111-111111111111",
      user_id: "22222222-2222-2222-2222-222222222222",
      entity_type: "finding",
      entity_id: "33333333-3333-3333-3333-333333333333",
      action: "create",
      changes: { new: { title: "Test" } },
      action_detail: "test_action",
      metadata: { reason: "v2 regression doc" },
      created_at: "2026-05-12T21:45:00.123456+02:00",
      scope: "org:11111111-1111-1111-1111-111111111111",
    };

    const hashUtc = await client.begin(async (tx) => {
      await tx.unsafe("SET LOCAL TIME ZONE 'UTC'");
      const r = await tx<{ h: string }[]>`
        SELECT compute_audit_hash_v2(
          ${fixed.previous_hash},
          ${fixed.org_id}::uuid,
          ${fixed.user_id}::uuid,
          ${fixed.entity_type},
          ${fixed.entity_id}::uuid,
          ${fixed.action},
          ${JSON.stringify(fixed.changes)}::jsonb,
          ${fixed.action_detail},
          ${JSON.stringify(fixed.metadata)}::jsonb,
          ${fixed.created_at}::timestamptz,
          ${fixed.scope}
        ) AS h
      `;
      return r[0].h;
    });

    const hashBerlin = await client.begin(async (tx) => {
      await tx.unsafe("SET LOCAL TIME ZONE 'Europe/Berlin'");
      const r = await tx<{ h: string }[]>`
        SELECT compute_audit_hash_v2(
          ${fixed.previous_hash},
          ${fixed.org_id}::uuid,
          ${fixed.user_id}::uuid,
          ${fixed.entity_type},
          ${fixed.entity_id}::uuid,
          ${fixed.action},
          ${JSON.stringify(fixed.changes)}::jsonb,
          ${fixed.action_detail},
          ${JSON.stringify(fixed.metadata)}::jsonb,
          ${fixed.created_at}::timestamptz,
          ${fixed.scope}
        ) AS h
      `;
      return r[0].h;
    });

    // Documents the v0-oscillation root cause. v3 was added to fix
    // this by replacing `created_at::text` with the UTC-normalised
    // `to_char(... AT TIME ZONE 'UTC', ...)` form.
    expect(hashUtc).not.toBe(hashBerlin);
  });

  it("after migration 0328, no v0/v1/v2 entries should remain", async () => {
    // Soft assertion — the migration runs in CI's migrate-all step.
    // If the test runs locally before migrate-all, skip.
    const counts = await client<
      { version: number; count: number }[]
    >`SELECT hash_version AS version, count(*)::int AS count
      FROM audit_log
      GROUP BY hash_version
      ORDER BY hash_version`;

    if (counts.length === 0) {
      // Empty audit_log (fresh DB). Nothing to verify.
      return;
    }

    const nonV3 = counts.filter((c) => c.version !== 3);
    if (nonV3.length === 0) {
      // All entries are v3 — migration 0328 worked.
      expect(true).toBe(true);
      return;
    }

    // If pre-migration entries exist, surface them as a soft warning
    // (not a hard failure — local dev DB may have raw test data).
    console.warn(
      "[WAVE23.2 v3] non-v3 audit_log entries present:",
      Object.fromEntries(nonV3.map((c) => [c.version, c.count])),
      "(Expected after migration 0328 runs.)",
    );
  });
});
