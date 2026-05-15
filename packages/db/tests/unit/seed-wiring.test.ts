// Seed-Wiring Regression Guard (Wave-21-W22-B2/B6)
//
// Wave-21 verification reported that ESG datapoints showed `total: 0`
// even though `seed_esrs_datapoints.sql` exists with 65 rows AND the
// PR #160 wired it into seed-all.ts's REFERENCE_SEEDS list. The QA
// findings could mean either of:
//   1. seed-all.ts was reverted in a later PR and we missed it
//   2. The production deploy didn't re-run seed-all.ts after the merge
//
// This test catches case (1) immediately. Case (2) needs an ops fix
// (re-run `npm run seed:all` against the live DB after deploy) — it's
// documented in the Wave-22 hotfix PR description.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SEED_ALL_PATH = join(__dirname, "..", "..", "src", "seed-all.ts");

describe("seed-all.ts wiring (Wave-21-W22-B2/B6)", () => {
  let seedAllSrc = "";

  it("seed-all.ts file exists", () => {
    seedAllSrc = readFileSync(SEED_ALL_PATH, "utf-8");
    expect(seedAllSrc.length).toBeGreaterThan(1000);
  });

  it("seed_esrs_datapoints.sql is in REFERENCE_SEEDS (Wave-21 W22-B2)", () => {
    expect(seedAllSrc).toContain('"seed_esrs_datapoints.sql"');
  });

  it("seed_demo_13_programmes.sql is wired (Wave-21 W22-B6)", () => {
    expect(seedAllSrc).toContain("seed_demo_13_programmes.sql");
  });

  it("Phase 2.6 runs AFTER Phase 2.5 (templates BEFORE journeys)", () => {
    // The journey FK lookups depend on programme_template rows
    // existing — phase ordering matters.
    const idxTemplates = seedAllSrc.indexOf("Phase 2.5");
    const idxJourneys = seedAllSrc.indexOf("seed_demo_13_programmes.sql");
    expect(idxTemplates).toBeGreaterThan(0);
    expect(idxJourneys).toBeGreaterThan(idxTemplates);
  });

  it("REFERENCE_SEEDS list still contains the 4 ESRS-related catalogs (regression)", () => {
    // If anyone "tidies up" the REFERENCE_SEEDS list and drops the
    // catalog seeds, `/compliance/frameworks` count drops below 46.
    expect(seedAllSrc).toContain('"seed_catalog_esrs.sql"');
    expect(seedAllSrc).toContain('"seed_catalog_iso27001_annex_a.sql"');
    expect(seedAllSrc).toContain('"seed_catalog_nist_csf2.sql"');
    expect(seedAllSrc).toContain('"seed_catalog_nis2.sql"');
  });

  it("0326_seed_arctistx_rbac_users.sql migration exists (W22-B7)", () => {
    const migPath = join(
      __dirname,
      "..",
      "..",
      "drizzle",
      "0326_seed_arctistx_rbac_users.sql",
    );
    const sql = readFileSync(migPath, "utf-8");
    expect(sql).toContain("ciso@arctistx.test");
    expect(sql).toContain("process-owner@arctistx.test");
    expect(sql).toContain("vendor-mgr@arctistx.test");
    // 3 risks for the cross-tenant probe.
    expect(sql.match(/INSERT INTO risk/g)?.length).toBeGreaterThanOrEqual(1);
  });
});
