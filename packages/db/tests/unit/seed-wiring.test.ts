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

  // [OP-268 · 2026-09-15] Die Behebung von OP-208 erreichte nur EINEN der
  // beiden Runner. `seed-all.ts` — der, den `deploy/update-all.sh` und die
  // Runbooks benutzen — hatte `fix_soa_annex_a.sql` nie in einer Liste, und
  // ohne die Projektion nach `control_catalog_entry` stirbt
  // `seed_demo_01_assets_isms.sql` an `catalog_entry_id` NOT NULL und nimmt
  // Assets, Bedrohungen und Schwachstellen mit. Am 2026-09-14 auf
  // `grc_platform` nachgemessen: `assets 0`.
  //
  // Der mandantenunabhaengige Teil steht jetzt in einer eigenen Datei, die in
  // BEIDE Runner gehoert. Diese Tests halten beide fest.
  const SEED_DEMO_PATH = join(__dirname, "..", "..", "src", "seed-demo.ts");
  const ANNEX_A_REF = '"seed_control_catalog_annex_a.sql"';

  it("seed_control_catalog_annex_a.sql ist in seed-all.ts verdrahtet (OP-268)", () => {
    expect(readFileSync(SEED_ALL_PATH, "utf-8")).toContain(ANNEX_A_REF);
  });

  it("seed_control_catalog_annex_a.sql ist in seed-demo.ts verdrahtet (OP-268)", () => {
    expect(readFileSync(SEED_DEMO_PATH, "utf-8")).toContain(ANNEX_A_REF);
  });

  it("die Projektion laeuft VOR seed_demo_01_assets_isms.sql (OP-268)", () => {
    for (const p of [SEED_ALL_PATH, SEED_DEMO_PATH]) {
      const src = readFileSync(p, "utf-8");
      const projektion = src.indexOf(ANNEX_A_REF);
      const assets = src.indexOf('"seed_demo_01_assets_isms.sql"');
      expect(projektion, `${p}: Projektion nicht verdrahtet`).toBeGreaterThan(
        0,
      );
      expect(assets, `${p}: assets-Seed nicht verdrahtet`).toBeGreaterThan(0);
      expect(
        projektion,
        `${p}: seed_control_catalog_annex_a.sql muss VOR seed_demo_01_assets_isms.sql stehen — sonst ist catalog_entry_id NULL und die Datei bricht ab.`,
      ).toBeLessThan(assets);
    }
  });

  it("fix_soa_annex_a.sql enthaelt keine mandantenunabhaengigen Schritte mehr (OP-268)", () => {
    const sql = readFileSync(
      join(__dirname, "..", "..", "sql", "fix_soa_annex_a.sql"),
      "utf-8",
    );
    // Nur der org-abhaengige Schritt 3 gehoert noch hierher. Stuenden die
    // Referenz-Schritte wieder daneben, rollt ein FK-Fehler sie erneut mit
    // zurueck — das war OP-208.
    expect(
      /INSERT\s+INTO\s+control_catalog\b/i.test(sql),
      "control_catalog gehoert nach seed_control_catalog_annex_a.sql",
    ).toBe(false);
    expect(
      /INSERT\s+INTO\s+control_catalog_entry\b/i.test(sql),
      "control_catalog_entry gehoert nach seed_control_catalog_annex_a.sql",
    ).toBe(false);
    expect(/INSERT\s+INTO\s+soa_entry\b/i.test(sql)).toBe(true);
  });

  it("Phase 1 meldet das Haekchen erst NACH dem await (OP-268)", () => {
    const src = readFileSync(SEED_ALL_PATH, "utf-8");
    // Das Haekchen stand vor dem `await`: eine gescheiterte Datei erschien
    // mit ✓ UND ✗. Gepruefft wird das Muster, nicht die Zeilennummer.
    expect(
      /console\.log\(`\s*✓ \$\{file\}`\);\s*\n\s*await client\.unsafe\(sql\);/.test(
        src,
      ),
      "seed-all.ts meldet ✓ vor dem await — Phase 1 wuerde gescheiterte Dateien als gelungen protokollieren.",
    ).toBe(false);
  });
});
