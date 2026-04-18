#!/usr/bin/env node
// audit-n-plus-one.mjs
//
// Static-analysis N+1 detector for apps/web/src/app/api/**.
// Flags patterns where a loop iterates an array from a DB read and then
// issues a DB call (db.select / db.insert / db.update / db.delete /
// db.execute) inside the loop body. These are classic candidates for a
// single bulk query + in-memory join.
//
// Heuristic, not a type-checker: false positives are expected. Every hit
// should be reviewed manually. Run:
//
//   node scripts/audit-n-plus-one.mjs
//
// Produces docs/perf/n-plus-one-report.md (+ -report.csv).

import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const API_DIR = join(ROOT, "apps/web/src/app/api");
const WORKER_DIR = join(ROOT, "apps/worker/src");
const OUT_DIR = join(ROOT, "docs/perf");
const OUT_MD = join(OUT_DIR, "n-plus-one-report.md");
const OUT_CSV = join(OUT_DIR, "n-plus-one-report.csv");

const DB_CALL = /\bdb\s*\.\s*(select|insert|update|delete|execute|query)\b/;
const LOOP_OPENERS = [
  /\bfor\s*\(/,
  /\bfor\s+(?:const|let|var)\s+.+\s+of\b/,
  /\bfor\s+(?:const|let|var)\s+.+\s+in\b/,
  /\bwhile\s*\(/,
  /\.(forEach|map|filter|reduce|flatMap|some|every)\s*\(/,
  /Promise\.all\s*\(\s*\w+\.map\s*\(/,
];

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      await walk(full, out);
    } else if (/\.(ts|tsx|mjs)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

function analyze(contents, file) {
  const lines = contents.split("\n");
  const findings = [];
  const depthStack = []; // entries: { openLine, kind }
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    if (!stripped.trim()) continue;

    const opensLoop = LOOP_OPENERS.some((r) => r.test(stripped));
    if (opensLoop) {
      depthStack.push({ openLine: i + 1, openBrace: braceDepth });
    }

    const opens = (stripped.match(/\{/g) || []).length;
    const closes = (stripped.match(/\}/g) || []).length;
    braceDepth += opens - closes;

    if (depthStack.length > 0 && DB_CALL.test(stripped)) {
      const top = depthStack[depthStack.length - 1];
      findings.push({
        file,
        loopLine: top.openLine,
        callLine: i + 1,
        snippet: stripped.trim().slice(0, 160),
      });
    }

    while (depthStack.length > 0 && braceDepth <= depthStack[depthStack.length - 1].openBrace) {
      depthStack.pop();
    }
  }

  return findings;
}

async function main() {
  const files = [
    ...(await walk(API_DIR)),
    ...(await walk(WORKER_DIR)),
  ];
  const allFindings = [];

  for (const f of files) {
    const c = await readFile(f, "utf8");
    if (!DB_CALL.test(c)) continue;
    const hits = analyze(c, f);
    allFindings.push(...hits);
  }

  allFindings.sort((a, b) => a.file.localeCompare(b.file) || a.loopLine - b.loopLine);

  await mkdir(OUT_DIR, { recursive: true });

  const md = [];
  md.push(`# N+1-Query-Report`);
  md.push(``);
  md.push(`_Generated: ${new Date().toISOString()}_`);
  md.push(``);
  md.push(`Static-Analyse findet Stellen, an denen ein Loop ueber ein Array iteriert und im Body einen DB-Call ausfuehrt. Das ist ein klassisches N+1-Muster.`);
  md.push(``);
  md.push(`**${allFindings.length} Kandidaten** in ${new Set(allFindings.map((h) => h.file)).size} Dateien.`);
  md.push(``);
  md.push(`Nicht jeder Treffer ist ein echter Bug: es gibt legitime Faelle wie Transaktions-Loops mit 1-5 Items oder Seed-Scripts. Jeden Hit einzeln reviewen.`);
  md.push(``);
  md.push(`## Empfohlene Fixes (Pattern)`);
  md.push(``);
  md.push(`| Muster | Fix |`);
  md.push(`|---|---|`);
  md.push(`| Loop + einzelne SELECTs per ID | \`inArray(table.id, ids)\` + Map<id, row> |`);
  md.push(`| Loop + einzelne INSERTs | \`db.insert(table).values([...])\` (bulk) |`);
  md.push(`| Loop mit await im Body | \`Promise.all(items.map(async ...))\` nur wenn DB-Pool >= N |`);
  md.push(`| Rekursive Baum-Abfrage | Rekursive CTE (\`WITH RECURSIVE\`) statt JS-Loop |`);
  md.push(``);
  md.push(`## Treffer`);
  md.push(``);
  md.push(`| Datei | Loop-Zeile | Call-Zeile | Snippet |`);
  md.push(`|---|---|---|---|`);

  for (const h of allFindings) {
    const rel = relative(ROOT, h.file).replace(/\\/g, "/");
    const snip = h.snippet.replace(/\|/g, "\\|");
    md.push(`| \`${rel}\` | ${h.loopLine} | ${h.callLine} | \`${snip}\` |`);
  }

  await writeFile(OUT_MD, md.join("\n"));

  const csv = ["file,loop_line,call_line,snippet"];
  for (const h of allFindings) {
    const rel = relative(ROOT, h.file).replace(/\\/g, "/");
    const snip = h.snippet.replace(/"/g, '""');
    csv.push(`"${rel}",${h.loopLine},${h.callLine},"${snip}"`);
  }
  await writeFile(OUT_CSV, csv.join("\n"));

  console.log(`Files scanned: ${files.length}`);
  console.log(`N+1 candidates: ${allFindings.length}`);
  console.log(`Files with hits: ${new Set(allFindings.map((h) => h.file)).size}`);
  console.log(`-> ${OUT_MD}`);
  console.log(`-> ${OUT_CSV}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
