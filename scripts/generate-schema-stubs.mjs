#!/usr/bin/env node
// generate-schema-stubs.mjs
//
// ADR-014 Phase 3 helper: for every table present in drizzle/ but absent
// from packages/db/src/schema/, generate a draft Drizzle pgTable() export.
// Writes packages/db/src/schema/_generated_stubs.ts and a review-ready
// markdown list.
//
// The generator is best-effort (regex-based DDL parsing). Developer must
// review each stub before wiring it into index.ts. Common cleanup:
//   - replace varchar(xx) type mappings with domain-specific types
//   - add FK references when missing
//   - tighten NULL constraints from the DDL

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SCHEMA_DIR = join(ROOT, "packages/db/src/schema");
const DRIZZLE_DIR = join(ROOT, "packages/db/drizzle");
const OUT_TS = join(SCHEMA_DIR, "_generated_stubs.ts");
const OUT_MD = join(ROOT, "docs/adr-014-phase3-stubs.md");

async function extractSchemaTableNames() {
  const files = (await readdir(SCHEMA_DIR)).filter((f) => f.endsWith(".ts"));
  const tables = new Set();
  for (const f of files) {
    const c = await readFile(join(SCHEMA_DIR, f), "utf8");
    const re = /pgTable\s*\(\s*["']([a-z_][a-z0-9_]*)["']\s*,/g;
    let m;
    while ((m = re.exec(c)) !== null) tables.add(m[1]);
  }
  return tables;
}

async function extractDdls() {
  const files = (await readdir(DRIZZLE_DIR)).filter((f) => f.endsWith(".sql"));
  const ddls = new Map(); // tableName -> full CREATE TABLE block
  for (const f of files) {
    const c = await readFile(join(DRIZZLE_DIR, f), "utf8");
    // Balanced-ish parser: find CREATE TABLE, capture until matching );
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["]?([a-z_][a-z0-9_]*)["]?\s*\(([^;]+?)\);/gis;
    let m;
    while ((m = re.exec(c)) !== null) {
      const name = m[1];
      if (name === "IF") continue; // regex false positive
      if (!ddls.has(name)) ddls.set(name, { body: m[2], source: f });
    }
  }
  return ddls;
}

function sqlTypeToDrizzle(sqlType, columnName) {
  const t = sqlType.toLowerCase();
  if (t.startsWith("uuid")) return `uuid("${columnName}")`;
  if (t.startsWith("varchar") || t.startsWith("character varying")) {
    const m = sqlType.match(/\((\d+)\)/);
    return `varchar("${columnName}", { length: ${m ? m[1] : 255} })`;
  }
  if (t === "text") return `text("${columnName}")`;
  if (t.startsWith("int") || t.startsWith("smallint") || t.startsWith("bigint")) return `integer("${columnName}")`;
  if (t.startsWith("numeric") || t.startsWith("decimal")) {
    const m = sqlType.match(/\((\d+)\s*,\s*(\d+)\)/);
    return m
      ? `numeric("${columnName}", { precision: ${m[1]}, scale: ${m[2]} })`
      : `numeric("${columnName}")`;
  }
  if (t === "boolean" || t === "bool") return `boolean("${columnName}")`;
  if (t.includes("timestamp")) return `timestamp("${columnName}", { withTimezone: true })`;
  if (t.includes("date")) return `date("${columnName}")`;
  if (t === "jsonb") return `jsonb("${columnName}")`;
  if (t === "json") return `jsonb("${columnName}")`;
  if (t === "inet") return `varchar("${columnName}", { length: 45 }) /* was inet */`;
  return `varchar("${columnName}", { length: 500 }) /* TYPE: ${sqlType.trim()} */`;
}

function camelCase(snake) {
  return snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function pascalCase(snake) {
  const cc = camelCase(snake);
  return cc.charAt(0).toUpperCase() + cc.slice(1);
}

function parseColumns(body) {
  // Split on commas that are NOT inside parens (naive, good enough for DDL)
  const parts = [];
  let depth = 0, buf = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf.trim());

  const columns = [];
  for (const part of parts) {
    // Skip CONSTRAINT clauses, PRIMARY KEY at table level, etc.
    if (/^\s*(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK)\b/i.test(part)) continue;
    const m = part.match(/^["]?([a-z_][a-z0-9_]*)["]?\s+([A-Za-z][A-Za-z0-9_\s()]+?)(?:\s+(?:NOT\s+)?NULL|\s+DEFAULT|\s+REFERENCES|\s+PRIMARY\s+KEY|\s+UNIQUE|$)/is);
    if (!m) continue;
    const colName = m[1];
    const sqlType = m[2].trim();
    const isNotNull = /NOT\s+NULL/i.test(part);
    const isPrimaryKey = /PRIMARY\s+KEY/i.test(part);
    const defaultMatch = part.match(/DEFAULT\s+([^,]+?)(?:\s+(?:NOT\s+)?NULL|$|\s+REFERENCES)/i);
    const references = part.match(/REFERENCES\s+["]?([a-z_]+)["]?\s*\(([^)]+)\)/i);

    let expr = sqlTypeToDrizzle(sqlType, colName);
    if (isPrimaryKey) expr += `.primaryKey()`;
    if (defaultMatch) {
      const def = defaultMatch[1].trim();
      if (def === "gen_random_uuid()") expr += `.defaultRandom()`;
      else if (def === "now()" || def === "CURRENT_TIMESTAMP") expr += `.defaultNow()`;
      else if (/^['"].*['"]$/.test(def)) expr += `.default(${def})`;
      else if (/^(true|false|[0-9]+)$/.test(def)) expr += `.default(${def})`;
      else expr += `/* DEFAULT ${def} */`;
    }
    if (isNotNull) expr += `.notNull()`;
    if (references) {
      expr += ` /* REFERENCES ${references[1]}(${references[2]}) — wire up manually */`;
    }
    columns.push({ camelName: camelCase(colName), sqlName: colName, expr });
  }
  return columns;
}

function generatePgTable(tableName, ddlBody) {
  const cols = parseColumns(ddlBody);
  const camel = camelCase(tableName);
  const lines = [];
  lines.push(`export const ${camel} = pgTable(`);
  lines.push(`  "${tableName}",`);
  lines.push(`  {`);
  for (const c of cols) {
    lines.push(`    ${c.camelName}: ${c.expr},`);
  }
  lines.push(`  },`);
  lines.push(`);`);
  lines.push(``);
  return lines.join("\n");
}

async function main() {
  const schemaTables = await extractSchemaTableNames();
  const ddls = await extractDdls();
  const missing = [...ddls.keys()].filter((t) => !schemaTables.has(t)).sort();

  console.log(`Schema pgTable entries: ${schemaTables.size}`);
  console.log(`drizzle/ CREATE TABLE entries: ${ddls.size}`);
  console.log(`Missing schema exports: ${missing.length}`);

  if (missing.length === 0) {
    console.log("No stubs needed.");
    return;
  }

  const header = [
    `// AUTO-GENERATED by scripts/generate-schema-stubs.mjs on ${new Date().toISOString()}`,
    `// `,
    `// ADR-014 Phase 3 scaffolding. For each table that exists in`,
    `// packages/db/drizzle/*.sql but had no pgTable() export, a draft stub`,
    `// is produced below. Developer action required before wiring into`,
    `// packages/db/src/index.ts:`,
    `//   1. Move each wanted table into the appropriate domain-specific`,
    `//      file (e.g. ai-act.ts, approval.ts, audit-mgmt.ts).`,
    `//   2. Replace FK-reference comments with real .references(() => ...)`,
    `//      calls -- import the referenced tables.`,
    `//   3. Verify column-type mappings: inet became varchar(45), custom`,
    `//      enum types became varchar(500), etc.`,
    `//   4. Delete this file once all stubs are migrated.`,
    `//`,
    `// This file is NOT exported via packages/db/src/index.ts -- no build`,
    `// impact until someone explicitly wires a table.`,
    ``,
    `import {`,
    `  pgTable,`,
    `  uuid,`,
    `  varchar,`,
    `  text,`,
    `  boolean,`,
    `  integer,`,
    `  numeric,`,
    `  timestamp,`,
    `  date,`,
    `  jsonb,`,
    `} from "drizzle-orm/pg-core";`,
    ``,
  ];
  const body = [];
  const mdLines = [
    `# ADR-014 Phase 3 — Schema-Stubs fuer bisher nicht exportierte Tabellen`,
    ``,
    `_Generated: ${new Date().toISOString()}_`,
    ``,
    `${missing.length} Tabellen existieren in \`packages/db/drizzle/*.sql\`, haben aber keinen \`pgTable()\`-Export in \`packages/db/src/schema/\`. Folge: Code kann sie nicht type-safe ansprechen (nur via \`db.execute(sql\`…\`)\`), und der Drift-Check (F-18) listet sie als \`extraInDb\`.`,
    ``,
    `Der auto-generierte Draft liegt in \`packages/db/src/schema/_generated_stubs.ts\`. Jeden Eintrag reviewen, in die passende Domain-Datei umziehen, FK-References verdrahten, dann aus _generated_stubs.ts loeschen.`,
    ``,
    `## Tabellen`,
    ``,
    `| Tabelle | Source-Migration |`,
    `|---|---|`,
  ];

  for (const table of missing) {
    const ddl = ddls.get(table);
    body.push(generatePgTable(table, ddl.body));
    mdLines.push(`| \`${table}\` | ${ddl.source} |`);
  }

  await writeFile(OUT_TS, header.concat(body).join("\n"));
  await writeFile(OUT_MD, mdLines.join("\n"));
  console.log(`→ Wrote ${OUT_TS}`);
  console.log(`→ Wrote ${OUT_MD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
