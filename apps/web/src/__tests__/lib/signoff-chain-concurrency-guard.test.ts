// Drift guard for the sign-off and audit chain-fork constraints.
//
// ── S03-18: what this file is, and what it is not ─────────────────────
//
// It used to describe itself as verifying the concurrency guard. It reads
// a migration file and greps it for constraint names — it verifies TEXT,
// not BEHAVIOUR. That distinction is not pedantic: this test passes
// against a migration that has never been applied, against a database
// where the constraint was dropped afterwards, and against a constraint
// whose definition no longer matches its name.
//
// The behaviour is asserted where a database exists, in
// `packages/db/tests/integration/audit-tamper-evidence.test.ts`:
// `pg_get_constraintdef` is read from the live catalogue for all three
// sign-off tables and for `audit_log`, and a forked insert is expected to
// be rejected.
//
// What this file legitimately does is guard against *drift in the
// migration source*: someone editing 0341 or 0402 and dropping the
// `NULLS NOT DISTINCT` qualifier, which is the part that actually
// prevents a second chain head, gets a red test in the DB-less unit run.
// The header no longer claims more than that.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DRIZZLE = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "packages",
  "db",
  "drizzle",
);

const SIGNOFF_MIGRATION = join(
  DRIZZLE,
  "0341_signoff_chain_concurrency_guard.sql",
);
const AUDIT_MIGRATION = join(
  DRIZZLE,
  "0402_audit_chain_order_and_fork_guard.sql",
);

describe("0341 sign-off chain fork guard (source drift check)", () => {
  const sql = readFileSync(SIGNOFF_MIGRATION, "utf8");

  for (const spec of [
    { table: "process_sign_off", col: "process_id" },
    { table: "audit_sign_off", col: "audit_id" },
    { table: "vendor_sign_off", col: "vendor_id" },
  ]) {
    it(`${spec.table} declares UNIQUE NULLS NOT DISTINCT on (${spec.col}, previous_chain_hash)`, () => {
      const constraintName = `${spec.table}_chain_uq`;
      expect(sql).toContain(constraintName);
      // The DROP IF EXISTS + ADD pattern is idempotent across re-runs.
      expect(sql).toMatch(
        new RegExp(
          `ALTER TABLE ${spec.table}[\\s\\S]*?ADD CONSTRAINT ${constraintName}[\\s\\S]*?UNIQUE NULLS NOT DISTINCT \\(${spec.col}, previous_chain_hash\\)`,
        ),
      );
    });
  }
});

describe("0402 audit_log chain fork guard (source drift check)", () => {
  const sql = readFileSync(AUDIT_MIGRATION, "utf8");

  it("declares UNIQUE NULLS NOT DISTINCT on (previous_hash_scope, previous_hash)", () => {
    // S03-09: the advisory lock from 0343 serialises writers but does not
    // refresh the blocked writer's snapshot, so under REPEATABLE READ the
    // chain forks. The sign-off tables solved the same problem correctly
    // at the constraint layer; audit_log now uses the same construction.
    expect(sql).toContain("audit_log_scope_prev_uniq");
    expect(sql).toMatch(
      /ADD CONSTRAINT audit_log_scope_prev_uniq[\s\S]*?UNIQUE NULLS NOT DISTINCT \(previous_hash_scope, previous_hash\)/,
    );
  });

  it("does not rehash history in order to repair the chain order", () => {
    // The repair renumbers chain_seq to follow the previous_hash linkage.
    // A rehash would recompute every entry_hash from the row's *current*
    // content, invalidating every Merkle root already timestamped and
    // blessing whatever changed the content. If a future edit turns this
    // migration into a rehash, this test goes red.
    expect(sql).not.toMatch(
      /UPDATE\s+audit_log[\s\S]{0,400}?SET[\s\S]{0,200}?entry_hash\s*=/i,
    );
    expect(sql).toContain("no hash was recomputed");
  });
});
