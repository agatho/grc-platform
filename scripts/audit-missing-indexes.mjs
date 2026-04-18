#!/usr/bin/env node
// audit-missing-indexes.mjs
//
// Static-DDL-Analyse: findet Spalten, die vermutlich einen Index
// brauchten, aber keinen haben. Drei Signale:
//
//   1. Jede Spalte, die mit `REFERENCES <table>(<col>)` deklariert ist,
//      sollte einen Index haben (FK-Lookups + JOIN-Performance).
//   2. Spalten mit Namen auf _id, _at, _by sind haeufige Filter/Sort-
//      Kandidaten.
//   3. Jede `org_id`-Spalte sollte indexiert sein (RLS-Policy evaluiert
//      `current_setting('app.current_org_id') = org_id` pro Row).
//
// Output: docs/perf/missing-indexes-report.md mit ADD-INDEX-SQL-Snippets.
// Nicht auto-applied -- nur Vorschlag fuer Review.

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DRIZZLE_DIR = join(ROOT, "packages/db/drizzle");
const MIGRATIONS_DIR = join(ROOT, "packages/db/src/migrations");
const OUT_DIR = join(ROOT, "docs/perf");
const OUT_MD = join(OUT_DIR, "missing-indexes-report.md");

async function readAllSql(dir) {
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    return "";
  }
  let all = "";
  for (const f of files) {
    all += "\n\n-- FILE: " + f + "\n" + (await readFile(join(dir, f), "utf8"));
  }
  return all;
}

function extractTables(sql) {
  // Map<tableName, { columns: [{ name, type, nullable, refs }], indexes: Set<colName(s)> }>
  const tables = new Map();

  const ct = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["]?([a-z_][a-z0-9_]*)["]?\s*\(([^;]+?)\);/gis;
  let m;
  while ((m = ct.exec(sql)) !== null) {
    const name = m[1];
    if (name === "IF") continue;
    const body = m[2];
    if (!tables.has(name)) tables.set(name, { columns: [], indexes: new Set() });
    const t = tables.get(name);

    // split by top-level commas
    const parts = [];
    let depth = 0, buf = "";
    for (const ch of body) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (ch === "," && depth === 0) { parts.push(buf.trim()); buf = ""; }
      else buf += ch;
    }
    if (buf.trim()) parts.push(buf.trim());

    for (const p of parts) {
      if (/^\s*(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK|EXCLUDE)\b/i.test(p)) {
        const refs = p.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+["]?([a-z_]+)["]?/i);
        if (refs) {
          const cols = refs[1].split(",").map((c) => c.trim().replace(/"/g, ""));
          if (cols.length === 1) {
            const col = t.columns.find((c) => c.name === cols[0]);
            if (col) col.refs = refs[2];
          }
        }
        if (/PRIMARY\s+KEY/i.test(p)) {
          const m2 = p.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
          if (m2) t.indexes.add(m2[1].replace(/["\s]/g, ""));
        }
        if (/UNIQUE/i.test(p) && /\(/.test(p)) {
          const m2 = p.match(/UNIQUE\s*\(([^)]+)\)/i);
          if (m2) t.indexes.add(m2[1].replace(/["\s]/g, ""));
        }
        continue;
      }
      const cm = p.match(/^["]?([a-z_][a-z0-9_]*)["]?\s+([A-Za-z][A-Za-z0-9_\s()]+?)(?:\s+(?:NOT\s+)?NULL|\s+DEFAULT|\s+REFERENCES|\s+PRIMARY\s+KEY|\s+UNIQUE|$)/is);
      if (!cm) continue;
      const col = { name: cm[1], type: cm[2].trim(), nullable: !/NOT\s+NULL/i.test(p), refs: null };
      const refMatch = p.match(/REFERENCES\s+["]?([a-z_]+)["]?/i);
      if (refMatch) col.refs = refMatch[1];
      if (/PRIMARY\s+KEY/i.test(p)) t.indexes.add(col.name);
      if (/\bUNIQUE\b/i.test(p)) t.indexes.add(col.name);
      t.columns.push(col);
    }
  }

  // CREATE INDEX ... ON <table> (col, ...)
  const idx = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["]?[a-z_][a-z0-9_]*["]?\s+ON\s+["]?([a-z_][a-z0-9_]*)["]?\s*(?:USING\s+\w+\s*)?\(([^)]+)\)/gi;
  let im;
  while ((im = idx.exec(sql)) !== null) {
    const table = im[1];
    const cols = im[2].replace(/["\s]/g, "");
    if (tables.has(table)) tables.get(table).indexes.add(cols);
  }

  return tables;
}

function suggestIndexes(tables) {
  const suggestions = [];
  for (const [table, t] of tables) {
    for (const col of t.columns) {
      const hasIdx = [...t.indexes].some((i) => i === col.name || i.startsWith(col.name + ","));
      if (hasIdx) continue;

      let reason = null;
      if (col.refs) reason = `FK -> ${col.refs}`;
      else if (col.name === "org_id") reason = "RLS-Filter";
      else if (/_id$/.test(col.name) && col.name !== "id") reason = "ID-Suffix";
      else if (col.name === "created_at" || col.name === "updated_at" || col.name === "deleted_at") reason = "Timestamp-Sort";
      else if (col.name === "status" || col.name === "state") reason = "Status-Filter";
      else if (/_by$/.test(col.name)) reason = "Audit-User-Filter";
      if (reason) {
        suggestions.push({ table, column: col.name, reason });
      }
    }
  }
  return suggestions;
}

async function main() {
  const sql = (await readAllSql(DRIZZLE_DIR)) + (await readAllSql(MIGRATIONS_DIR));
  const tables = extractTables(sql);
  const suggestions = suggestIndexes(tables);

  await mkdir(OUT_DIR, { recursive: true });

  const byReason = new Map();
  for (const s of suggestions) {
    if (!byReason.has(s.reason)) byReason.set(s.reason, []);
    byReason.get(s.reason).push(s);
  }

  const md = [];
  md.push(`# Missing-Indexes-Report`);
  md.push(``);
  md.push(`_Generated: ${new Date().toISOString()}_`);
  md.push(``);
  md.push(`Statische DDL-Analyse identifiziert Spalten, die wahrscheinlich einen Index brauchen. Heuristik, kein Query-Plan: bitte mit EXPLAIN/ANALYZE auf Live-DB validieren, bevor Index erstellt wird.`);
  md.push(``);
  md.push(`**${tables.size} Tabellen analysiert, ${suggestions.length} Index-Kandidaten.**`);
  md.push(``);
  md.push(`## Prioritaeten-Hinweis`);
  md.push(``);
  md.push(`| Reason | Was | Priorisierung |`);
  md.push(`|---|---|---|`);
  md.push(`| RLS-Filter | \`org_id\` Index fehlt | **HIGH** -- RLS-Policy prueft pro Row |`);
  md.push(`| FK | FK-Spalte ohne Index | **HIGH** -- JOIN-Performance + Delete-Cascade |`);
  md.push(`| ID-Suffix | \`xxx_id\` ohne FK aber ohne Index | Medium -- oft Filter |`);
  md.push(`| Timestamp-Sort | \`created_at/updated_at\` | Medium -- ORDER BY |`);
  md.push(`| Status-Filter | \`status/state\` | Low -- geringe Cardinality |`);
  md.push(`| Audit-User-Filter | \`created_by/updated_by\` | Low |`);
  md.push(``);

  for (const [reason, items] of [...byReason.entries()].sort()) {
    md.push(`## ${reason} (${items.length})`);
    md.push(``);
    md.push(`\`\`\`sql`);
    for (const s of items.slice(0, 200)) {
      md.push(`CREATE INDEX IF NOT EXISTS idx_${s.table}_${s.column} ON ${s.table}(${s.column});`);
    }
    if (items.length > 200) md.push(`-- ... ${items.length - 200} more`);
    md.push(`\`\`\``);
    md.push(``);
  }

  await writeFile(OUT_MD, md.join("\n"));

  console.log(`Tables analyzed: ${tables.size}`);
  console.log(`Index suggestions: ${suggestions.length}`);
  for (const [reason, items] of byReason) console.log(`  ${reason}: ${items.length}`);
  console.log(`-> ${OUT_MD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
