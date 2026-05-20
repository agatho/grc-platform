// Asserts that migration 0341 declares the UNIQUE NULLS NOT DISTINCT
// constraints that keep concurrent POST /sign-off requests from branching
// the hash chain on each of the 3 sign-off tables.
//
// Static-fixture test — reads the migration SQL and greps. The actual
// DB-level enforcement is verified by the DB Migration & Integrity job
// in CI, which applies every migration to a real Postgres.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "packages",
  "db",
  "drizzle",
  "0341_signoff_chain_concurrency_guard.sql",
);

describe("0341 sign-off chain concurrency guard", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  for (const spec of [
    { table: "process_sign_off", col: "process_id" },
    { table: "audit_sign_off", col: "audit_id" },
    { table: "vendor_sign_off", col: "vendor_id" },
  ]) {
    it(`${spec.table} has UNIQUE NULLS NOT DISTINCT on (${spec.col}, previous_chain_hash)`, () => {
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
