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
  // #WAVE19-P3-03: 65 ESRS-Datapoints (E1-E5, S1-S4, G1) needed by
  // POST /esg/metrics + /esg/measurements which require datapointId.
  // Without this seed those endpoints 422 with
  // {fieldErrors:{datapointId:['Required']}} because the dropdown
  // discovery (`GET /esg/datapoints`) returns empty.
  "seed_esrs_datapoints.sql",
  "seed_fachliche_stammdaten.sql",
  "seed_cross_framework_mappings.sql",
];

// ── Demo data (risks, controls, documents, etc.) ─────────────────────────
// These files use hardcoded org/user UUIDs that must be replaced at runtime.
const DEMO_SEEDS = [
  "seed_demo_data.sql", // budgets, risks, controls, treatments (base)
  "seed_demo_09_processes.sql", // processes (before BCMS which references them)
  "seed_demo_08_documents.sql", // documents
  "seed_demo_01_assets_isms.sql", // assets, threats, vulns, SoA (partial — SoA FK may fail)
  "seed_demo_02_dpms.sql", // RoPA, DPIA, DSR, breaches
  "seed_demo_03_audit.sql", // audit plans, checklists
  "seed_demo_04_tprm_contracts.sql", // vendors, contracts, SLA
  "seed_demo_05_bcms.sql", // BIA, crisis, strategies, exercises
  "seed_demo_06_kris.sql", // KRIs + measurements
  "seed_demo_07_tasks_findings.sql", // tasks, findings
  "seed_demo_10_control_tests.sql", // control test runs
  "seed_demo_11_extended.sql", // 15 additional risks, 10 controls, 5 findings
  "seed_tag_definitions.sql", // predefined tag definitions per org
  "seed_emission_factors_eu.sql", // EU emission factors (DE/AT/CH/EU/UK/FR/NL/PL/IT/ES)
  "seed_catalog_issb_ifrs.sql", // ISSB/IFRS S1+S2 sustainability standards
  "seed_catalog_gri_2021.sql", // GRI Standards 2021
  "seed_catalog_tcfd.sql", // TCFD Recommendations
  "seed_catalog_eu_taxonomy.sql", // EU Taxonomy for Sustainable Activities
  "seed_catalog_coso_icif.sql", // COSO ICIF 2013 Internal Control Framework
  "seed_catalog_cdp.sql", // CDP Climate Change Questionnaire 2024
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
    `SELECT id FROM organization WHERE name LIKE '%Meridian%' LIMIT 1`,
  );
  const [usr] = await client.unsafe(
    `SELECT id FROM "user" WHERE email = 'admin@arctos.dev' LIMIT 1`,
  );

  if (!org || !usr) {
    console.error(
      "  ✗ Could not find Meridian org or admin user — run seed.ts first!",
    );
    await client.end();
    process.exit(1);
  }

  const newOrgId = org.id as string;
  const newUserId = usr.id as string;
  console.log(`  Org: ${newOrgId} | Admin: ${newUserId}\n`);

  // Disable audit triggers on tables where they reference missing columns
  // (the demo data triggers expect columns like 'description' or 'title'
  //  which may not exist in the current trigger function)
  const triggerTables = [
    "document",
    "process",
    "finding",
    "soa_entry",
    "bia_assessment",
    "bia_process_impact",
    "bcp",
    "crisis_scenario",
    "bc_exercise",
    "continuity_strategy",
    "audit",
    "audit_plan",
  ];
  for (const table of triggerTables) {
    try {
      await client.unsafe(`ALTER TABLE "${table}" DISABLE TRIGGER ALL`);
    } catch {
      /* table may not exist */
    }
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
    } catch {
      /* table may not exist */
    }
  }

  // ── 3.5 Programme Cockpit Templates ────────────────────────────────────
  // Templates seeded BEFORE journeys (the SQL below references them).
  console.log("\nPhase 2.5: Programme Cockpit templates");
  try {
    const { seedProgrammeTemplates } =
      await import("./seeds/programme-templates.js");
    const r = await seedProgrammeTemplates();
    console.log(
      `  ✓ ${r.templatesSeeded} templates, ${r.phasesSeeded} phases, ${r.stepsSeeded} steps`,
    );
  } catch (err) {
    console.error("  ✗ programme-templates seed:", (err as Error).message);
  }

  // ── 3.6 Programme Journey demo instances ────────────────────────────────
  // #WAVE21-W22-B6: 2 concrete programme journeys per Meridian (ISO 27001
  // Cert 2026 + DSGVO Roadmap 2026). Runs AFTER programme-templates so
  // the FK lookups resolve. Idempotent via ON CONFLICT (org_id, name).
  console.log("\nPhase 2.6: Programme Cockpit journeys (demo instances)");
  try {
    let sql = readFileSync(
      join(SQL_DIR, "seed_demo_13_programmes.sql"),
      "utf-8",
    );
    sql = sql.replaceAll(OLD_ORG_ID, newOrgId);
    sql = sql.replaceAll(OLD_USER_ID, newUserId);
    sql = sql.replace(/^BEGIN;/gm, "-- BEGIN;");
    sql = sql.replace(/^COMMIT;/gm, "-- COMMIT;");
    await client.unsafe(sql);
    const [{ n }] = await client.unsafe(
      `SELECT count(*)::int AS n FROM programme_journey WHERE org_id = '${newOrgId}'`,
    );
    console.log(`  ✓ ${n} programme journeys for Meridian`);
  } catch (err) {
    console.error("  ✗ seed_demo_13_programmes.sql:", (err as Error).message);
  }

  // ── 3.7 Juli-2026-Feature-Demo-Daten ────────────────────────────────────
  // seed_demo_14_july_features.sql: Prozesslandkarte, Freigabekette +
  // Kenntnisnahme, Management-Review-Cockpit, DMS Effective-Dating +
  // e-Signatur (pgcrypto-Hash-Kette), Risk-Acceptance + Authority-Matrix,
  // Retention-Policy. Idempotent (ON CONFLICT DO NOTHING + UPDATE-Guards).
  // Der Seed referenziert neben dem Haupt-User weitere Demo-User per
  // fester UUID; auf frisch geseedeten DBs (seed.ts) werden diese per
  // E-Mail nachgeschlagen und ersetzt (Fallback: Admin-User).
  console.log("\nPhase 2.7: July 2026 feature demo data");
  try {
    let sql = readFileSync(
      join(SQL_DIR, "seed_demo_14_july_features.sql"),
      "utf-8",
    );
    sql = sql.replaceAll(OLD_ORG_ID, newOrgId);

    // Secondary demo users referenced by seed_demo_14 (see seed_demo_00)
    const SECONDARY_USERS: Record<string, string> = {
      "f22a4bc0-0147-4c0d-a02f-98cf65f1e768": "admin@arctos.dev",
      "d4e5f6a7-b8c9-0123-def0-456789abcdef": "compliance@arctos.dev",
      "a7b8c9d0-e1f2-3456-0123-789abcdef012": "qm@arctos.dev",
      "f6a7b8c9-d0e1-2345-f012-6789abcdef01": "contracts@arctos.dev",
      "e1f2a3b4-c5d6-7890-4567-bcdef0123456": "risk@arctos.dev",
      "d0e1f2a3-b4c5-6789-3456-abcdef012345": "dpo@arctos.dev",
    };
    for (const [oldId, email] of Object.entries(SECONDARY_USERS)) {
      const [u] = await client.unsafe(
        `SELECT id FROM "user" WHERE email = '${email}' LIMIT 1`,
      );
      sql = sql.replaceAll(oldId, (u?.id as string) ?? newUserId);
    }
    // Main user LAST so secondary fallbacks above stay deterministic
    sql = sql.replaceAll(OLD_USER_ID, newUserId);
    sql = sql.replace(/^BEGIN;/gm, "-- BEGIN;");
    sql = sql.replace(/^COMMIT;/gm, "-- COMMIT;");
    await client.unsafe(sql);
    console.log("  ✓ seed_demo_14_july_features.sql");
  } catch (err) {
    console.error(
      "  ✗ seed_demo_14_july_features.sql:",
      (err as Error).message,
    );
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
