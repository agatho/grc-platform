// seed-all.ts — Run AFTER seed.ts
// Loads catalog frameworks, module definitions, work-item types, and demo data.
// Demo data SQL uses deterministic UUIDs; this script replaces the hardcoded
// org/user IDs with the actual IDs from the freshly seeded database.

import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const client = postgres(process.env.DATABASE_URL!);
const SQL_DIR = join(__dirname, "../sql");

// ── Reference data (catalogs, module defs, work-item types) ──────────────
const REFERENCE_SEEDS = [
  "seed_module_definitions_sprint4_9.sql",
  "seed_work_item_types_sprint5_9.sql",
  "seed_catalog_iso27002_2022.sql",
  "seed_catalog_bsi_threats.sql",
  "seed_catalog_nist_csf2.sql",
  "seed_catalog_cambridge_v2.sql",
  "seed_catalog_wef_global_risks.sql",
  "seed_catalog_cis_controls_v8.sql",
  // Additional catalog frameworks (29 total)
  "seed_catalog_gdpr.sql",
  "seed_catalog_gdpr_data_categories.sql",
  "seed_catalog_gdpr_legal_bases.sql",
  "seed_catalog_nis2.sql",
  "seed_catalog_dora.sql",
  "seed_catalog_ai_act.sql",
  "seed_catalog_bsi_grundschutz.sql",
  "seed_catalog_iso27001_annex_a.sql",
  "seed_catalog_iso22301.sql",
  "seed_catalog_mitre_attack.sql",
  "seed_catalog_tisax.sql",
  "seed_catalog_cobit2019.sql",
  "seed_catalog_coso_erm.sql",
  "seed_catalog_idw_ps.sql",
  "seed_catalog_iia_standards.sql",
  "seed_catalog_isae3402_soc2.sql",
  "seed_catalog_toms.sql",
  "seed_catalog_owasp_asvs.sql",
  "seed_catalog_esrs.sql",
  "seed_fachliche_stammdaten.sql",
  "seed_cross_framework_mappings.sql",
];

// ── Demo data (risks, controls, documents, etc.) ─────────────────────────
// These files use hardcoded org/user UUIDs that must be replaced at runtime.
const DEMO_SEEDS = [
  "seed_demo_data.sql",           // budgets, risks, controls, treatments (base)
  "seed_demo_09_processes.sql",   // processes (before BCMS which references them)
  "seed_demo_08_documents.sql",   // documents
  "seed_demo_01_assets_isms.sql", // assets, threats, vulns, SoA (partial — SoA FK may fail)
  "seed_demo_02_dpms.sql",        // RoPA, DPIA, DSR, breaches
  "seed_demo_03_audit.sql",       // audit plans, checklists
  "seed_demo_04_tprm_contracts.sql", // vendors, contracts, SLA
  "seed_demo_05_bcms.sql",        // BIA, crisis, strategies, exercises
  "seed_demo_06_kris.sql",        // KRIs + measurements
  "seed_demo_07_tasks_findings.sql", // tasks, findings
  "seed_demo_10_control_tests.sql",  // control test runs
  "seed_demo_11_extended.sql",       // 15 additional risks, 10 controls, 5 findings
  "seed_tag_definitions.sql",        // predefined tag definitions per org
];

// Hardcoded UUIDs used in the demo SQL files (from original LXC deployment)
const OLD_ORG_ID = "ccc4cc1c-4b09-499c-8420-ebd8da655cd7";
const OLD_USER_ID = "8c148f0a-f558-4a9f-8886-a3d7096da6cf";

async function main() {
  console.log("Running ARCTOS seed-all...\n");

  // ── 1. Reference data ──────────────────────────────────────────────────
  console.log("Phase 1: Reference data (catalogs, modules, types)");
  for (const file of REFERENCE_SEEDS) {
    try {
      const sql = readFileSync(join(SQL_DIR, file), "utf-8");
      console.log(`  ✓ ${file}`);
      await client.unsafe(sql);
    } catch (err) {
      console.error(`  ✗ ${file}:`, (err as Error).message);
    }
  }

  // ── 2. Re-enable modules for any newly added module_definitions ────────
  console.log("\n  Enabling new modules for all organizations...");
  const enableResult = await client.unsafe(`
    INSERT INTO module_config (id, org_id, module_key, ui_status, is_data_active, config, enabled_at, created_at, updated_at)
    SELECT gen_random_uuid(), o.id, md.module_key, 'enabled', true, '{}', now(), now(), now()
    FROM organization o
    CROSS JOIN module_definition md
    WHERE o.deleted_at IS NULL
    ON CONFLICT ON CONSTRAINT module_config_org_module_uq DO NOTHING
  `);
  console.log(`  ✓ ${enableResult.count} new module configs enabled`);

  // ── 3. Demo data ───────────────────────────────────────────────────────
  console.log("\nPhase 2: Demo data (risks, controls, documents, ...)");

  // Look up the actual org + admin user IDs from the live database
  const [org] = await client.unsafe(
    `SELECT id FROM organization WHERE name LIKE '%Meridian%' LIMIT 1`
  );
  const [usr] = await client.unsafe(
    `SELECT id FROM "user" WHERE email = 'admin@arctos.dev' LIMIT 1`
  );

  if (!org || !usr) {
    console.error("  ✗ Could not find Meridian org or admin user — run seed.ts first!");
    await client.end();
    process.exit(1);
  }

  const newOrgId = org.id as string;
  const newUserId = usr.id as string;
  console.log(`  Org: ${newOrgId} | Admin: ${newUserId}\n`);

  // Disable audit triggers on tables where they reference missing columns
  // (the demo data triggers expect columns like 'description' or 'title'
  //  which may not exist in the current trigger function)
  const triggerTables = ["document", "process", "finding", "soa_entry",
    "bia_assessment", "bia_process_impact", "bcp", "crisis_scenario",
    "bc_exercise", "continuity_strategy", "audit", "audit_plan"];
  for (const table of triggerTables) {
    try {
      await client.unsafe(`ALTER TABLE "${table}" DISABLE TRIGGER ALL`);
    } catch { /* table may not exist */ }
  }

  for (const file of DEMO_SEEDS) {
    try {
      let sql = readFileSync(join(SQL_DIR, file), "utf-8");

      // Replace hardcoded UUIDs with actual IDs
      sql = sql.replaceAll(OLD_ORG_ID, newOrgId);
      sql = sql.replaceAll(OLD_USER_ID, newUserId);

      // Remove BEGIN/COMMIT so individual row errors don't kill the whole file
      sql = sql.replace(/^BEGIN;/gm, "-- BEGIN;");
      sql = sql.replace(/^COMMIT;/gm, "-- COMMIT;");

      await client.unsafe(sql);
      console.log(`  ✓ ${file}`);
    } catch (err) {
      console.error(`  ✗ ${file}:`, (err as Error).message);
    }
  }

  // Re-enable triggers
  for (const table of triggerTables) {
    try {
      await client.unsafe(`ALTER TABLE "${table}" ENABLE TRIGGER ALL`);
    } catch { /* table may not exist */ }
  }

  // ── 4. Summary ─────────────────────────────────────────────────────────
  console.log("\n── Summary ──");
  const counts = await client.unsafe(`
    SELECT 'risks' as entity, count(*)::int as n FROM risk
    UNION ALL SELECT 'controls', count(*)::int FROM control
    UNION ALL SELECT 'documents', count(*)::int FROM document
    UNION ALL SELECT 'tasks', count(*)::int FROM task
    UNION ALL SELECT 'assets', count(*)::int FROM asset
    UNION ALL SELECT 'vendors', count(*)::int FROM vendor
    UNION ALL SELECT 'processes', count(*)::int FROM process
    UNION ALL SELECT 'kris', count(*)::int FROM kri
    UNION ALL SELECT 'catalogs', count(*)::int FROM catalog
    UNION ALL SELECT 'catalog_entries', count(*)::int FROM catalog_entry
    UNION ALL SELECT 'module_configs', count(*)::int FROM module_config
    ORDER BY 1
  `);
  for (const row of counts) {
    console.log(`  ${String(row.entity).padEnd(18)} ${row.n}`);
  }

  console.log("\nSeed-all complete.");
  await client.end();
}

main().catch((err) => {
  console.error("Seed-all failed:", err);
  process.exit(1);
});
