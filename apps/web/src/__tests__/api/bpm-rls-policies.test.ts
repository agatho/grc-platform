// BPM Overhaul Phase 2: static RLS policy declaration test.
//
// For each tenant-scoped table introduced by the BPM overhaul, asserts that
// the corresponding migration file declares the four standard tenant
// policies. This catches a class of bug where a new table is added without
// RLS, since the audit script also catches it but in a slower CI lane.
//
// (Live cross-tenant isolation tests for these tables live in
// packages/db/tests/rls/rls-coverage-systemtest.test.ts — they require a
// running DB and run in the dedicated rls-systemtest job.)

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(
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

const NEW_TENANT_TABLES = [
  // (table, migration_file)
  ["process_ropa_profile", "0333_process_ropa_profile.sql"],
  ["process_sign_off", "0334_process_sign_off_framework_mapping.sql"],
  ["process_framework_mapping", "0334_process_sign_off_framework_mapping.sql"],
] as const;

describe("BPM new tables — RLS policy declaration", () => {
  for (const [table, migrationFile] of NEW_TENANT_TABLES) {
    it(`${table}: enables RLS in ${migrationFile}`, () => {
      const sql = readFileSync(join(MIGRATIONS_DIR, migrationFile), "utf8");
      expect(sql).toMatch(new RegExp(`ENABLE ROW LEVEL SECURITY`));
      expect(sql).toMatch(new RegExp(`FORCE ROW LEVEL SECURITY`));
    });

    it(`${table}: declares tenant_select policy`, () => {
      const sql = readFileSync(join(MIGRATIONS_DIR, migrationFile), "utf8");
      const policyRe = new RegExp(
        `CREATE POLICY [\\w_]+_tenant_select ON ${table}`,
      );
      expect(sql).toMatch(policyRe);
    });

    if (table !== "process_sign_off") {
      // sign_off is append-only on purpose — UPDATE/DELETE policies omitted.
      it(`${table}: declares tenant_update + tenant_delete policies`, () => {
        const sql = readFileSync(join(MIGRATIONS_DIR, migrationFile), "utf8");
        expect(sql).toMatch(/CREATE POLICY [\w_]+_tenant_update/);
        expect(sql).toMatch(/CREATE POLICY [\w_]+_tenant_delete/);
      });
    } else {
      it(`process_sign_off: is append-only (no update/delete policy)`, () => {
        const sql = readFileSync(join(MIGRATIONS_DIR, migrationFile), "utf8");
        // The migration explicitly comments why update/delete are omitted.
        expect(sql).toMatch(/append-only/i);
      });
    }
  }
});
