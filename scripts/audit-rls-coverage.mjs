#!/usr/bin/env node
// audit-rls-coverage.mjs
//
// Static-analysis tool: extracts every table defined in the Drizzle schema
// (`packages/db/src/schema/*.ts`) and checks whether:
//   - An ENABLE ROW LEVEL SECURITY statement exists for it in any migration
//   - A CREATE POLICY statement exists for it in any migration
//   - An audit_trigger() registration exists for it
//
// Writes a markdown report to docs/security/rls-coverage-report.md
// and a machine-readable CSV for tooling.

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SCHEMA_DIR = join(ROOT, "packages/db/src/schema");
const MIGRATIONS_DIRS = [
  join(ROOT, "packages/db/drizzle"),
  join(ROOT, "packages/db/src/migrations"),
];
const OUT_DIR = join(ROOT, "docs/security");

async function extractTables() {
  const files = (await readdir(SCHEMA_DIR)).filter((f) => f.endsWith(".ts"));
  const tables = new Map(); // tableName -> schemaFile
  for (const f of files) {
    const content = await readFile(join(SCHEMA_DIR, f), "utf8");
    // Match: pgTable("table_name", ...
    const re = /pgTable\(\s*["']([a-z_][a-z0-9_]*)["']/gi;
    let m;
    while ((m = re.exec(content)) !== null) {
      if (!tables.has(m[1])) tables.set(m[1], f);
    }
  }
  return tables;
}

async function scanMigrations() {
  const rlsEnabled = new Set();
  const policies = new Set();
  const auditTriggers = new Set();
  for (const dir of MIGRATIONS_DIRS) {
    let files;
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".sql"));
    } catch {
      continue;
    }
    for (const f of files) {
      const content = await readFile(join(dir, f), "utf8");
      // ENABLE ROW LEVEL SECURITY
      const rlsRe = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?["']?([a-z_][a-z0-9_]*)["']?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
      let m;
      while ((m = rlsRe.exec(content)) !== null) rlsEnabled.add(m[1]);
      // CREATE POLICY ... ON table_name
      const polRe = /CREATE\s+POLICY\s+[^\s]+\s+ON\s+["']?([a-z_][a-z0-9_]*)["']?/gi;
      while ((m = polRe.exec(content)) !== null) policies.add(m[1]);
      // CREATE TRIGGER ... ON table FOR EACH ROW EXECUTE (PROCEDURE|FUNCTION) audit_trigger
      const audRe = /CREATE\s+TRIGGER\s+[^\s]+\s+AFTER\s+(?:INSERT|UPDATE|DELETE)[^;]+?ON\s+["']?([a-z_][a-z0-9_]*)["']?[^;]+audit_trigger/gis;
      while ((m = audRe.exec(content)) !== null) auditTriggers.add(m[1]);
    }
  }
  return { rlsEnabled, policies, auditTriggers };
}

const TABLES_WITHOUT_ORG_ID = new Set([
  // Platform-wide tables (no multi-tenant isolation needed)
  "user", "module_definition", "work_item_type",
  "catalog", "catalog_entry", "catalog_entry_reference",
  "user_ssoprovider", "user_mfa",
  // Log tables (tied to org via org_id but typically RLS is looser)
  "audit_log", "access_log", "data_export_log",
  // ADR-014 Phase 3 -- globale Registry-Tabellen ohne org_id
  "catalog_entry_mapping",    // Cross-Framework-Mappings sind plattform-global
  "connector_type_definition", // Connector-Registry ist plattform-global
  "connector_test_definition", // pre-existing, dito
  "module_nav_item",          // Navigation pro Modul ist plattform-global
  "xbrl_taxonomy",            // XBRL-Taxonomien sind industry-weite Standards
  "xbrl_tag",                 // XBRL-Tags gehoeren zur Taxonomie, nicht zum Tenant
]);

async function main() {
  console.log("→ Extracting tables from schema...");
  const tables = await extractTables();
  console.log(`  Found ${tables.size} tables`);

  console.log("→ Scanning migrations for RLS + audit_trigger...");
  const { rlsEnabled, policies, auditTriggers } = await scanMigrations();
  console.log(`  RLS enabled on ${rlsEnabled.size} tables, ${policies.size} policies, ${auditTriggers.size} audit triggers`);

  // Classify each table
  const rows = [];
  for (const [table, file] of [...tables.entries()].sort()) {
    const needsRLS = !TABLES_WITHOUT_ORG_ID.has(table);
    const rlsOK = rlsEnabled.has(table);
    const policyOK = policies.has(table);
    const auditOK = auditTriggers.has(table);
    const status =
      needsRLS && !rlsOK ? "RLS_MISSING" :
      needsRLS && !policyOK ? "POLICY_MISSING" :
      needsRLS && !auditOK ? "AUDIT_MISSING" :
      !needsRLS ? "PLATFORM_EXEMPT" :
      "OK";
    rows.push({ table, file, needsRLS, rlsOK, policyOK, auditOK, status });
  }

  const counts = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});

  await mkdir(OUT_DIR, { recursive: true });

  // Markdown report
  const mdLines = [
    `# RLS + Audit-Trail Coverage Report`,
    ``,
    `_Generated: ${new Date().toISOString()}_`,
    ``,
    `## Summary`,
    ``,
    `| Status | Count |`,
    `|---|---|`,
    ...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`),
    `| **Total** | **${rows.length}** |`,
    ``,
    `## Semantics`,
    ``,
    `- \`RLS_MISSING\`: Table contains \`org_id\` (multi-tenant) but no \`ENABLE ROW LEVEL SECURITY\` statement was found in any migration.`,
    `- \`POLICY_MISSING\`: RLS enabled but no \`CREATE POLICY\` referencing the table.`,
    `- \`AUDIT_MISSING\`: Table missing an \`audit_trigger()\` registration (ADR-011).`,
    `- \`PLATFORM_EXEMPT\`: Platform-wide table (user, module_definition, catalog, …) which by design does not use org-scoped RLS.`,
    `- \`OK\`: RLS + policy + audit trigger all present.`,
    ``,
    `## Findings by status`,
    ``,
  ];

  for (const status of ["RLS_MISSING", "POLICY_MISSING", "AUDIT_MISSING", "PLATFORM_EXEMPT", "OK"]) {
    const list = rows.filter((r) => r.status === status);
    if (list.length === 0) continue;
    mdLines.push(`### ${status} (${list.length})`);
    mdLines.push("");
    mdLines.push(`| Table | Schema file | RLS | Policy | Audit |`);
    mdLines.push(`|---|---|---|---|---|`);
    for (const r of list) {
      mdLines.push(`| \`${r.table}\` | ${r.file} | ${r.rlsOK ? "✅" : "❌"} | ${r.policyOK ? "✅" : "❌"} | ${r.auditOK ? "✅" : "❌"} |`);
    }
    mdLines.push("");
  }

  mdLines.push(`## Methodology`);
  mdLines.push(``);
  mdLines.push(`This report is static analysis only:`);
  mdLines.push(`- Tables extracted from \`pgTable("name", ...)\` calls in \`packages/db/src/schema/*.ts\``);
  mdLines.push(`- RLS/policies/audit detected via regex over all \`*.sql\` in \`packages/db/drizzle/\` and \`packages/db/src/migrations/\``);
  mdLines.push(`- \`PLATFORM_EXEMPT\` list is hand-curated (see script \`scripts/audit-rls-coverage.mjs\`)`);
  mdLines.push(``);
  mdLines.push(`False positives are possible if RLS is enabled via custom SQL not matched by the regex (e.g. dynamic SQL, conditional DO blocks that only fire under specific branches). Cross-check via \`SELECT * FROM pg_policies\` in the live DB for authoritative data.`);
  mdLines.push(``);

  await writeFile(join(OUT_DIR, "rls-coverage-report.md"), mdLines.join("\n"));

  // CSV
  const csv = [
    "table,schema_file,needs_rls,rls_enabled,policy_present,audit_trigger,status",
    ...rows.map(
      (r) => `${r.table},${r.file},${r.needsRLS},${r.rlsOK},${r.policyOK},${r.auditOK},${r.status}`,
    ),
  ].join("\n");
  await writeFile(join(OUT_DIR, "rls-coverage-report.csv"), csv);

  console.log(`→ Wrote docs/security/rls-coverage-report.{md,csv}`);
  console.log("→ Summary:", counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
