// packages/db/src/seed-demo.ts
//
// `npm run db:seed:demo` — applies the reference catalogs and the demo data
// set, in dependency order, through the same postgres client the rest of the
// package uses.
//
// [E2E-TRIAGE-2026-09-02] Why this exists
// ---------------------------------------
// `db:seed:demo` used to be `scripts/seed-demo.sh`, a psql loop with four
// independent defects, each of which alone was enough to leave the database
// empty while the command printed "Done.":
//
//   1. It listed ELEVEN of the sixteen `seed_demo_*.sql` files, and the one it
//      omitted first was `seed_demo_00_platform.sql` — the file whose own
//      header says it must run BEFORE all the others, because it creates the
//      two organisations (`c2446a5c…`, `ccc4cc1c…`) and the ten personas that
//      every other demo file references. Without it, every INSERT in the other
//      ten violated a foreign key. `_11_extended`, `_12_ai_act`,
//      `_13_programmes` and `_14_july_features` were missing too — `_12` is
//      the file that seeds the AI-Act register (AIS-001 … AIS-005) the
//      `ai-act-workflow` specs look for.
//   2. It never applied the REFERENCE seeds (control catalogs, module
//      definitions, work-item types). `seed_demo_01_assets_isms.sql` writes
//      `soa_entry` rows with a foreign key into `control_catalog_entry`, so
//      without the ISO 27001 Annex A catalog it fails — and takes the rest of
//      its transaction with it.
//   3. Every psql invocation ended in `>/dev/null 2>&1 || true`. Both the
//      "relation does not exist" and the foreign-key errors were discarded,
//      so the script could not report a failure even in principle.
//   4. It read `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASS`/`DB_NAME` from `.env`
//      and defaulted to `localhost:5432`. `.env` in this repository defines
//      `DATABASE_URL` and nothing else, and the dev database listens on 5433.
//
// Measured consequence on the environment this triage ran against: after
// `db:seed && db:seed:demo`, `asset`, `control`, `audit`, `vendor`, `dpia`,
// `finding`, `kri` and the whole `ai_*` family held ZERO rows, and roughly
// half of the E2E suite failed looking for demo data that no command had ever
// managed to write.
//
// Each file is applied on its own; a failure is reported with its Postgres
// error, the connection is rolled back so the next file starts clean, and the
// process exits non-zero at the end. Ordering below is the one `seed-all.ts`
// established (processes before BCMS, documents before the modules that link
// them, assets before SoA), extended by the four files nothing ever ran.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const SQL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "sql");

/**
 * Reference data the demo files depend on: control/risk catalogs, module
 * definitions, work-item types. Anything listed here that is absent from the
 * directory is skipped silently — the list spans several sprints and not every
 * checkout carries every framework.
 */
const REFERENCE_SEEDS = [
  "seed_module_definitions_sprint4_9.sql",
  "seed_work_item_types_sprint5_9.sql",
  "seed_catalog_iso27001_annex_a.sql",
  "seed_catalog_iso27002_2022.sql",
  "seed_catalog_bsi_threats.sql",
  "seed_catalog_bsi_grundschutz.sql",
  "seed_catalog_nist_csf2.sql",
  "seed_catalog_cambridge_v2.sql",
  "seed_catalog_wef_global_risks.sql",
  "seed_catalog_cis_controls_v8.sql",
  "seed_catalog_gdpr.sql",
  "seed_catalog_gdpr_data_categories.sql",
  "seed_catalog_gdpr_legal_bases.sql",
  "seed_catalog_nis2.sql",
  "seed_catalog_dora.sql",
  "seed_catalog_ai_act.sql",
  "seed_catalog_iso22301.sql",
  "seed_catalog_mitre_attack.sql",
  "seed_catalog_tisax.sql",
  "seed_catalog_cobit2019.sql",
  "seed_catalog_coso_erm.sql",
  "seed_catalog_coso_icif.sql",
  "seed_catalog_idw_ps.sql",
  "seed_catalog_iia_standards.sql",
  "seed_catalog_isae3402_soc2.sql",
  "seed_catalog_toms.sql",
  "seed_catalog_owasp_asvs.sql",
  "seed_catalog_esrs.sql",
  "seed_catalog_issb_ifrs.sql",
  "seed_catalog_gri_2021.sql",
  "seed_catalog_tcfd.sql",
  "seed_catalog_eu_taxonomy.sql",
  "seed_catalog_cdp.sql",
  "seed_esrs_datapoints.sql",
  "seed_emission_factors_eu.sql",
  "seed_fachliche_stammdaten.sql",
  "seed_cross_framework_mappings.sql",
  "seed_tag_definitions.sql",
  // `seed_catalog_iso27001_annex_a.sql` fills `catalog_entry`. `soa_entry`
  // (seed_demo_01) has a foreign key into `control_catalog_entry`, which is a
  // different table and which nothing populated — so demo_01 died on
  // `soa_entry_catalog_entry_id_control_catalog_entry_id_fk` and took its
  // assets, threats and vulnerabilities down with it. This projection file
  // exists for exactly that and was never wired into any seed command.
  "fix_soa_annex_a.sql",
];

/**
 * Demo data, in dependency order. `00_platform` FIRST — it creates the orgs,
 * personas and roles the rest reference.
 */
const DEMO_SEEDS = [
  "seed_demo_00_platform.sql",
  "seed_demo_data.sql", // budgets, risks, controls, treatments (base)
  "seed_demo_09_processes.sql", // processes — BCMS references them
  "seed_demo_08_documents.sql", // documents
  "seed_demo_01_assets_isms.sql", // assets, threats, vulns, SoA
  "seed_demo_02_dpms.sql", // RoPA, DPIA, DSR, breaches
  "seed_demo_03_audit.sql", // audit plans, checklists
  "seed_demo_04_tprm_contracts.sql", // vendors, contracts, SLA
  "seed_demo_05_bcms.sql", // BIA, crisis, strategies, exercises
  "seed_demo_06_kris.sql", // KRIs + measurements
  // 10 BEFORE 07: `finding.control_test_id` references `control_test`, which
  // only `seed_demo_10_control_tests.sql` creates. Both `seed-all.ts` and the
  // old shell script had 07 first, so the findings insert failed on
  // `finding_control_test_id_control_test_id_fk` every single time.
  "seed_demo_10_control_tests.sql", // control test runs
  "seed_demo_07_tasks_findings.sql", // tasks, findings
  "seed_demo_11_extended.sql", // additional risks, controls, findings
  "seed_demo_12_ai_act.sql", // EU AI Act register (AIS-001 …)
  "seed_demo_13_programmes.sql", // programme journeys
  "seed_demo_14_july_features.sql", // later feature demo rows
  // [E2E-TRIAGE-4 · 2026-09-02] CVE feed, asset CPEs, CVE/asset matches.
  // Measured before this file existed: `cve_feed_item`, `asset_cpe` and
  // `cve_asset_match` held ZERO rows on a fully seeded database, so the whole
  // vulnerability-intelligence surface had never been exercised and
  // `i-08-cve-flow` skipped itself on every run. AFTER 01, which creates the
  // assets the matches reference.
  "seed_demo_15_cve.sql",
];

/**
 * The files this runner applies, in order. Exported so a test can assert that
 * no `seed_demo_*.sql` in the directory is silently left out again — the
 * omission of `00_platform` is what made the old script a no-op.
 */
export function demoSeedFiles(dir: string = SQL_DIR): string[] {
  const ordered = [...REFERENCE_SEEDS, ...DEMO_SEEDS].filter((f) =>
    existsSync(join(dir, f)),
  );
  // Anything matching seed_demo_*.sql that the explicit list forgot still runs,
  // after the ordered set, rather than being dropped without a word.
  const extras = readdirSync(dir)
    .filter(
      (f) =>
        f.startsWith("seed_demo_") &&
        f.endsWith(".sql") &&
        !ordered.includes(f),
    )
    .sort();
  return [...ordered, ...extras];
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — seed-demo derives its connection from it. " +
        "(The shell script it replaces guessed localhost:5432 from DB_* " +
        "variables this repository does not define, and seeded nothing.)",
    );
  }

  // #SEC-F04: same guard as scripts/docker-entrypoint.sh — this creates demo
  // tenants and demo personas and must never touch a production instance.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_SEED_IN_PROD !== "true"
  ) {
    console.warn(
      "Refusing to seed demo data in production; set " +
        "ALLOW_DEMO_SEED_IN_PROD=true to override.",
    );
    return;
  }

  const files = demoSeedFiles();
  console.log(`Seeding reference + demo data (${files.length} files)...`);

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const failures: Array<{ file: string; message: string }> = [];
  try {
    for (const file of files) {
      const body = readFileSync(join(SQL_DIR, file), "utf8");
      try {
        await sql.unsafe(body);
        console.log(`  ok    ${file}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ file, message });
        console.error(`  FAIL  ${file}: ${message}`);
        // Several files open their own BEGIN. A statement that fails inside one
        // leaves the connection in "current transaction is aborted" and every
        // later file would report that instead of its own result. Reset it.
        await sql.unsafe("rollback").catch(() => undefined);
      }
    }
  } finally {
    await sql.end();
  }

  if (failures.length > 0) {
    throw new Error(
      `${failures.length} of ${files.length} seed file(s) failed:\n` +
        failures.map((f) => `  - ${f.file}: ${f.message}`).join("\n"),
    );
  }
  console.log("Reference + demo data seeded.");
}

// Only run when invoked directly (`tsx src/seed-demo.ts`), not when imported by
// a test that wants `demoSeedFiles()`.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("/seed-demo.ts")) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
