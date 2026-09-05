// #WP3-S02-14 — das Rollenmodell hat genau EINE Quelle der Wahrheit.
//
// Befund: DB-Enum `user_role` = 9 Werte, TypeScript-Union = 20 Werte,
// `withAuth(...)`-Guards = 17 Werte. 113 Guard-Slots über 79 Routendateien
// waren nicht zuweisbar, weil ihr Rollenwert im Enum fehlte
// (`POST /users/{id}/roles` mit `{"role":"ciso"}` → 22P02). Praktische Folge:
// Least Privilege war nicht umsetzbar — wer ISMS-Freigaben brauchte, musste
// `admin` bekommen, was die Wirkung von S02-02 und S02-03 verstärkte.
//
// Dieser Test hält die drei Seiten zusammen:
//   1. TS-Liste  ←→ Migration 0410 (die das DB-Enum idempotent herstellt)
//   2. TS-Liste  ←→ jede Rolle, die im Routenbaum in `withAuth(...)` steht
//   3. TS-Liste  ←→ die Rollen, auf die die HinSchG-Isolation prüft
//
// Damit ist Drift ein Testfehler statt eines Produktionsausfalls.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, sep } from "path";
import { USER_ROLES, isUserRole } from "../src/types/platform";

const REPO_ROOT = join(__dirname, "../../..");
const MIGRATION = join(
  REPO_ROOT,
  "packages/db/drizzle/0410_user_role_enum_single_source.sql",
);
const API_ROOT = join(REPO_ROOT, "apps/web/src/app/api");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (entry === "route.ts") acc.push(p);
  }
  return acc;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("S02-14 — one source of truth for the role model", () => {
  it("the TS list is non-empty, unique and exactly 20 roles", () => {
    expect(new Set(USER_ROLES).size).toBe(USER_ROLES.length);
    expect(USER_ROLES.length).toBe(20);
  });

  it("migration 0410 declares exactly the roles of the TS list", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const declared = new Set(
      [...sql.matchAll(/ADD VALUE IF NOT EXISTS '([a-z_]+)'/g)].map(
        (m) => m[1],
      ),
    );
    const ts = new Set<string>(USER_ROLES);

    const missingInMigration = [...ts].filter((r) => !declared.has(r));
    const extraInMigration = [...declared].filter(
      (r) => r !== undefined && !ts.has(r),
    );

    expect(missingInMigration).toEqual([]);
    expect(extraInMigration).toEqual([]);
  });

  it("every role used in a withAuth(...) guard exists in the role model", () => {
    const used = new Set<string>();
    for (const file of walk(API_ROOT)) {
      const src = stripComments(readFileSync(file, "utf8"));
      for (const m of src.matchAll(/withAuth\(([^)]*)\)/g)) {
        for (const r of (m[1] ?? "").matchAll(/"([a-z_]+)"/g)) {
          used.add(r[1] ?? "");
        }
      }
    }
    // The audit counted 17 distinct guard roles, 8 of which were not
    // assignable. Every one of them must now resolve.
    const unknown = [...used].filter((r) => !isUserRole(r));
    expect(unknown).toEqual([]);
    expect(used.size).toBeGreaterThanOrEqual(15);
  });

  it("the roles the audit flagged as unassignable are part of the model", () => {
    // S02-14: ciso, esg_manager, compliance_officer, esg_contributor,
    // ombudsperson (S07-22), quality_manager (S06-12), contract_manager,
    // bcm_manager — 113 guard slots that could not be granted.
    for (const role of [
      "ciso",
      "esg_manager",
      "compliance_officer",
      "esg_contributor",
      "ombudsperson",
      "quality_manager",
      "contract_manager",
      "bcm_manager",
    ]) {
      expect(isUserRole(role)).toBe(true);
    }
  });

  it("the HinSchG isolation roles are part of the model", () => {
    expect(isUserRole("whistleblowing_officer")).toBe(true);
    expect(isUserRole("ombudsperson")).toBe(true);
  });

  it("rejects values outside the model", () => {
    expect(isUserRole("superadmin")).toBe(false);
    expect(isUserRole("")).toBe(false);
    expect(isUserRole(undefined)).toBe(false);
  });
});
