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

  // #WAVE22-FOLLOWUP: the first run of seed_demo_13_programmes.sql
  // failed with `invalid input value for enum
  // programme_journey_status: "in_progress"` because the seed used
  // the WRONG enum (programme_step_status has 'in_progress';
  // programme_journey_status doesn't). This test pins that the seed
  // file doesn't reintroduce the invalid value.
  it("seed_demo_13_programmes.sql does NOT use 'in_progress' (wrong enum)", () => {
    const seedPath = join(
      __dirname,
      "..",
      "..",
      "sql",
      "seed_demo_13_programmes.sql",
    );
    const sql = readFileSync(seedPath, "utf-8");
    // Look for status='in_progress' specifically — the literal must
    // NOT appear as a status value. (It can appear in a comment, so
    // we only fail on the literal-on-its-own-line VALUES form.)
    const invalidStatusLine = /^\s*'in_progress',\s*$/m.test(sql);
    expect(
      invalidStatusLine,
      "seed_demo_13_programmes.sql contains 'in_progress' as a status literal — that's NOT a valid programme_journey_status enum value (valid: planned, active, on_track, at_risk, blocked, completed, archived).",
    ).toBe(false);
  });

  // [OP-268 · 2026-09-15] The OP-208 fix reached only ONE of the two runners.
  // `seed-all.ts` never had `fix_soa_annex_a.sql` in any list, and without the
  // projection into `control_catalog_entry`, `seed_demo_01_assets_isms.sql`
  // dies on `catalog_entry_id` NOT NULL and takes assets, threats and
  // vulnerabilities with it. Measured on `grc_platform` 2026-09-14:
  // `assets 0`.
  //
  // The tenant-independent part now lives in its own file, which belongs in
  // BOTH runners. These tests pin both.
  const SEED_DEMO_PATH = join(__dirname, "..", "..", "src", "seed-demo.ts");
  const ANNEX_A_REF = '"seed_control_catalog_annex_a.sql"';

  it("seed_control_catalog_annex_a.sql is wired into seed-all.ts (OP-268)", () => {
    expect(readFileSync(SEED_ALL_PATH, "utf-8")).toContain(ANNEX_A_REF);
  });

  it("seed_control_catalog_annex_a.sql is wired into seed-demo.ts (OP-268)", () => {
    expect(readFileSync(SEED_DEMO_PATH, "utf-8")).toContain(ANNEX_A_REF);
  });

  it("the projection runs BEFORE seed_demo_01_assets_isms.sql (OP-268)", () => {
    for (const p of [SEED_ALL_PATH, SEED_DEMO_PATH]) {
      const src = readFileSync(p, "utf-8");
      const projection = src.indexOf(ANNEX_A_REF);
      const assets = src.indexOf('"seed_demo_01_assets_isms.sql"');
      expect(projection, `${p}: projection not wired in`).toBeGreaterThan(0);
      expect(assets, `${p}: assets seed not wired in`).toBeGreaterThan(0);
      expect(
        projection,
        `${p}: seed_control_catalog_annex_a.sql must come BEFORE seed_demo_01_assets_isms.sql — otherwise catalog_entry_id is NULL and the file aborts.`,
      ).toBeLessThan(assets);
    }
  });

  it("fix_soa_annex_a.sql no longer contains tenant-independent steps (OP-268)", () => {
    const sql = readFileSync(
      join(__dirname, "..", "..", "sql", "fix_soa_annex_a.sql"),
      "utf-8",
    );
    // Only the org-dependent step 3 still belongs here. If the reference
    // steps sat next to it again, an FK error would roll them back with it
    // once more — that was OP-208.
    expect(
      /INSERT\s+INTO\s+control_catalog\b/i.test(sql),
      "control_catalog belongs in seed_control_catalog_annex_a.sql",
    ).toBe(false);
    expect(
      /INSERT\s+INTO\s+control_catalog_entry\b/i.test(sql),
      "control_catalog_entry belongs in seed_control_catalog_annex_a.sql",
    ).toBe(false);
    expect(/INSERT\s+INTO\s+soa_entry\b/i.test(sql)).toBe(true);
  });

  it("phase 1 prints the tick only AFTER the await (OP-268)", () => {
    const src = readFileSync(SEED_ALL_PATH, "utf-8");
    // The tick used to be printed before the `await`: a failing file showed
    // up with ✓ AND ✗. The pattern is checked, not the line number.
    expect(
      /console\.log\(`\s*✓ \$\{file\}`\);\s*\n\s*await client\.unsafe\(sql\);/.test(
        src,
      ),
      "seed-all.ts prints ✓ before the await — phase 1 would log failing files as successful.",
    ).toBe(false);
  });

  // [OP-270] `deploy/update-all.sh` runs neither seed runner — deliberately,
  // because seed-all.ts phase 2 is demo data (#S13-20). The Annex A
  // projection is NOT demo data: `control_catalog_entry` is what the SoA
  // module reads, nothing else fills it, and without it every tenant created
  // by the normal deploy path has an empty Statement of Applicability. It
  // must therefore also run from `deploy/seed-catalogs.sh`, which step 3b
  // calls for every database.
  it("the Annex A projection also runs from deploy/seed-catalogs.sh (OP-270)", () => {
    const script = readFileSync(
      join(__dirname, "..", "..", "..", "..", "deploy", "seed-catalogs.sh"),
      "utf-8",
    );
    expect(
      script.includes("seed_control_catalog_annex_a.sql"),
      "Without this the deploy path leaves control_catalog_entry empty and the SoA module has no controls.",
    ).toBe(true);
    // It reads the entries that the catalog loop writes, so it has to come
    // after that loop.
    const loop = script.indexOf('for f in "$SQL_DIR"/seed_catalog_');
    const projection = script.indexOf(
      "$SQL_DIR/seed_control_catalog_annex_a.sql",
    );
    expect(loop).toBeGreaterThan(0);
    expect(
      projection,
      "The projection reads catalog_entry rows written by seed_catalog_iso27001_annex_a.sql — it must run after the catalog loop.",
    ).toBeGreaterThan(loop);
  });
});
