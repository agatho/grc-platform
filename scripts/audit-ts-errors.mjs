#!/usr/bin/env node
// audit-ts-errors.mjs
//
// Run tsc --noEmit on apps/web, group errors by code + by dominant
// pattern, write docs/perf/ts-errors-report.md for review.
//
// Heuristik-Kategorien:
//   - drizzle-rows: `.rows` auf db.execute()-Ergebnis -- postgres-js
//     gibt das Array direkt zurueck, .rows existiert nicht
//   - null-safety: 18048, 2538 (index mit undefined, null-checks)
//   - type-mismatch: 2322, 2345, 2352, 2559 (Typ passt nicht)
//   - property-missing: 2339 ohne .rows (echte fehlende Props)
//   - implicit-any: 7006

import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const OUT_DIR = join(ROOT, "docs/perf");
const OUT_MD = join(OUT_DIR, "ts-errors-report.md");

function runTsc() {
  return new Promise((resolve) => {
    const proc = spawn("npx.cmd", ["tsc", "--noEmit", "--project", "apps/web/tsconfig.json"], {
      cwd: ROOT, shell: true,
    });
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (out += d.toString()));
    proc.on("close", () => resolve(out));
  });
}

function parse(output) {
  const errors = [];
  const re = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/gm;
  let m;
  while ((m = re.exec(output)) !== null) {
    errors.push({ file: m[1], line: Number(m[2]), col: Number(m[3]), code: m[4], message: m[5] });
  }
  return errors;
}

function categorize(e) {
  if (e.code === "TS2339" && /Property 'rows' does not exist/.test(e.message)) return "drizzle-rows";
  if (e.code === "TS18048" || e.code === "TS2538") return "null-safety";
  if (["TS2322", "TS2345", "TS2352", "TS2559", "TS2551", "TS2353"].includes(e.code)) return "type-mismatch";
  if (e.code === "TS2307") return "missing-module";
  if (e.code === "TS7006") return "implicit-any";
  if (e.code === "TS2554") return "arg-count";
  if (e.code === "TS2339") return "property-missing";
  if (e.code === "TS2769") return "overload-mismatch";
  if (e.code === "TS2367") return "comparison-no-overlap";
  return "other";
}

async function main() {
  console.log("Running tsc (this takes ~30-60s)...");
  const out = await runTsc();
  const errors = parse(out);
  console.log(`Total errors: ${errors.length}`);

  await mkdir(OUT_DIR, { recursive: true });

  const byCat = new Map();
  const byCode = new Map();
  const byFile = new Map();
  for (const e of errors) {
    const cat = categorize(e);
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(e);
    byCode.set(e.code, (byCode.get(e.code) ?? 0) + 1);
    byFile.set(e.file, (byFile.get(e.file) ?? 0) + 1);
  }

  const md = [];
  md.push(`# TypeScript-Errors-Report`);
  md.push(``);
  md.push(`_Generated: ${new Date().toISOString()}_`);
  md.push(``);
  md.push(`**Total: ${errors.length} Fehler** in ${byFile.size} Dateien.`);
  md.push(``);
  md.push(`Build laeuft trotzdem (\`ignoreBuildErrors\` ist aktiv fuer apps/web). Die Fehler sind also Entwicklungs-Bugs, keine Build-Blocker.`);
  md.push(``);

  md.push(`## Nach Kategorie`);
  md.push(``);
  md.push(`| Kategorie | Anzahl | Fix-Strategie |`);
  md.push(`|---|---|---|`);
  const strat = {
    "drizzle-rows": "db.execute() in postgres-js gibt Array direkt zurueck -- `.rows` entfernen, ggf. Type-Cast. RISKANT: runtime-kompatibel pruefen.",
    "null-safety": "Null-Guard / Optional-Chaining / Default-Wert einsetzen.",
    "type-mismatch": "Typ angleichen (Zod-Schema vs Drizzle-Spalte, Enum vs String).",
    "missing-module": "Paket installieren oder Import auf `unknown` widen.",
    "implicit-any": "Explizite Type-Annotation hinzufuegen.",
    "arg-count": "Signatur-Call korrigieren.",
    "property-missing": "Property existiert wirklich nicht -- Code reviewen.",
    "overload-mismatch": "Funktions-Overload prueft, ggf. Argument-Typen anpassen.",
    "comparison-no-overlap": "`===` zwischen disjunkten Literal-Types -- Logik-Bug.",
    "other": "Einzeln reviewen.",
  };
  for (const [cat, items] of [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
    md.push(`| \`${cat}\` | ${items.length} | ${strat[cat] ?? "-"} |`);
  }
  md.push(``);

  md.push(`## Nach TS-Code`);
  md.push(``);
  md.push(`| Code | Anzahl |`);
  md.push(`|---|---|`);
  for (const [code, n] of [...byCode.entries()].sort((a, b) => b[1] - a[1])) {
    md.push(`| ${code} | ${n} |`);
  }
  md.push(``);

  md.push(`## Hot-Spots (Dateien mit >=3 Errors)`);
  md.push(``);
  md.push(`| Datei | Anzahl |`);
  md.push(`|---|---|`);
  for (const [f, n] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
    if (n < 3) break;
    const rel = f.replace(/\\/g, "/");
    md.push(`| \`${rel}\` | ${n} |`);
  }
  md.push(``);

  md.push(`## Priorisierung fuer Fixes`);
  md.push(``);
  md.push(`1. **null-safety** (einfache isolierte Fixes) -- quick wins`);
  md.push(`2. **implicit-any / arg-count / missing-module** -- isoliert`);
  md.push(`3. **type-mismatch** -- Zod vs Drizzle synchronisieren (mittel)`);
  md.push(`4. **drizzle-rows** -- erfordert Runtime-Validierung (ADR-014: ggf. eigene ADR fuer Drizzle-Migration)`);
  md.push(``);

  await writeFile(OUT_MD, md.join("\n"));
  console.log(`-> ${OUT_MD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
