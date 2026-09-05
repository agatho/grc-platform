#!/usr/bin/env node
// audit-dead-exports.mjs
//
// Findet `export`-Statements in apps/web/src und packages/*/src, die
// nirgendwo importiert werden. Heuristik, nicht perfekt:
//   - Ignoriert default-exports in Route-Files (Next.js convention)
//   - Ignoriert API-Route-HTTP-Handler (GET/POST/PUT/PATCH/DELETE)
//   - Ignoriert page.tsx/layout.tsx/template.tsx exports
//   - Ignoriert _stubs und generated-Files
//   - Falsch-Positive moeglich bei Barrel-Imports und dynamic imports
//
// Output: docs/perf/dead-exports-report.md
// Nicht auto-fixed -- nur Vorschlagsliste zum manuellen Review.
//
// ============================================================================
// [ARCTOS-FULL-2026-08-31 · OP-074, OP-075] Ratsche und Frischeprüfung.
//
// Zwei Befunde am selben Werkzeug:
//
//   OP-074 — der eingecheckte Report war veraltet. Er nannte 1.991 tote
//     Exporte in 322 Dateien; gemessen wurden 2.765 in 470. Die Differenz ist
//     nicht der Punkt, die STILLE ist es: nichts hat je verglichen, was der
//     Report behauptet, mit dem, was das Werkzeug misst.
//
//   OP-075 — es gab kein CI-Tor. Die drei anderen Ratschen (Lint, Coverage,
//     i18n) haben eins; diese Zahl konnte beliebig wachsen.
//
// `--check` behebt beides in einem Schritt, weil beides dieselbe Frage ist:
//
//   1. Ratsche — die Gesamtzahl UND die Zahl je Datei dürfen nicht steigen,
//      und eine Datei, die in der Baseline nicht vorkommt, darf nicht mit
//      toten Exporten neu auftauchen. Ohne den Teil „je Datei" liesse sich
//      ein neues Modul voller toter Exporte hinter dem Aufräumen eines
//      anderen verstecken.
//   2. Frische — der eingecheckte Report muss die GEMESSENE Zahl nennen.
//      Ein Report, den niemand nachrechnet, ist wieder OP-074.
//
// Fail-closed, ausdrücklich (Lehre aus #S08-26): fehlt die Baseline, fehlt
// der Report, oder lässt sich seine Kennzahl nicht lesen, ist das ein
// FEHLER — kein Freibrief. Ein Tor, das bei fehlender Eingabe grün wird,
// ist schlimmer als keins.
//
// Die Baseline liegt als `.dead-exports-ratchet.json` in der WURZEL, neben
// `.eslint-ratchet.json` und `.coverage-ratchet.json` — ausserhalb jedes
// Artefaktverzeichnisses, damit sie nicht wie bei C-15/OP-066 durch eine
// .gitignore-Regel aus dem Repository fällt. `scripts/check-gate-inputs.mjs`
// führt sie und prüft genau das.
//
// Aufruf:
//   node scripts/audit-dead-exports.mjs                    # messen + Report
//   node scripts/audit-dead-exports.mjs --check            # Tor (CI)
//   node scripts/audit-dead-exports.mjs --update-baseline  # Baseline senken
//   node scripts/audit-dead-exports.mjs --update-baseline --reason "…"
//
// Eine ANHEBUNG ohne `--reason` wird abgelehnt und mit den Deltas in
// `_history` festgehalten — wie bei der Lint- und der Coverage-Ratsche.
// ============================================================================

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { format as prettierFormat, resolveConfig } from "prettier";

const ROOT = new URL("..", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);
const SRC_DIRS = [
  join(ROOT, "apps/web/src"),
  join(ROOT, "apps/worker/src"),
  join(ROOT, "packages/shared/src"),
  join(ROOT, "packages/db/src"),
  join(ROOT, "packages/auth/src"),
  join(ROOT, "packages/events/src"),
  join(ROOT, "packages/automation/src"),
];

// [Welle 5c] Verzeichnisse, die nur den IMPORT-Index speisen: ihre Exporte
// werden nicht gezaehlt, ihre Importe zaehlen aber als Benutzung.
//
// Warum das noetig ist: bis hierher hiess "tot" wortwoertlich "kein
// import-Statement in SRC_DIRS". Ein Symbol, das eine Testsuite einfuehrt,
// um eine reine Entscheidungsfunktion ohne Datenbank pruefen zu koennen,
// galt damit als toter Export — und der Autor hatte genau zwei Auswege:
// die Pruefnaht wieder entfernen oder die Ratsche hochstellen. CONTRIBUTING
// nennt beides als abzulehnende Abkuerzung, und der Kopf dieser Datei
// nennt "Falsch-Positive moeglich" ohnehin schon als bekannte Schwaeche.
// Ein Symbol, das ein Test importiert, IST importiert.
//
// Die Exporte der Testdateien selbst bleiben ungezaehlt: `walk()` laeuft
// dafuer weiterhin nur ueber SRC_DIRS.
const IMPORT_ONLY_DIRS = [
  join(ROOT, "apps/web/tests"),
  join(ROOT, "apps/worker/tests"),
  join(ROOT, "packages/shared/tests"),
  join(ROOT, "packages/db/tests"),
  join(ROOT, "packages/auth/tests"),
  join(ROOT, "packages/events/tests"),
  join(ROOT, "packages/automation/tests"),
];
const OUT_DIR = join(ROOT, "docs/perf");
const OUT_MD = join(OUT_DIR, "dead-exports-report.md");
const BASELINE = join(ROOT, ".dead-exports-ratchet.json");

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const UPDATE = argv.includes("--update-baseline");

const NEXT_ROUTE_EXPORTS = new Set([
  "default",
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "generateStaticParams",
  "generateMetadata",
  "metadata",
  "dynamic",
  "revalidate",
  "fetchCache",
  "runtime",
  "preferredRegion",
  "viewport",
  "generateViewport",
]);

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
      if (
        e.name === "node_modules" ||
        e.name === ".next" ||
        e.name === "__generated__"
      )
        continue;
      await walk(full, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

function extractExports(content, file) {
  const exports = [];
  const isRouteOrPage =
    /\\(api|app)\\.*\\(route|page|layout|template|loading|not-found|error|default)\.tsx?$|route\.ts$|page\.tsx$|layout\.tsx$/.test(
      file,
    );
  const isStub = /_generated_stubs|_stubs|\\generated\\/i.test(file);
  if (isStub) return [];

  const re =
    /^export\s+(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    const name = m[1];
    if (isRouteOrPage && NEXT_ROUTE_EXPORTS.has(name)) continue;
    exports.push({ name, file });
  }

  // export { a, b, c } from "..."
  const reBarrel = /^export\s*\{\s*([^}]+)\s*\}/gm;
  while ((m = reBarrel.exec(content)) !== null) {
    for (const name of m[1].split(",").map((s) =>
      s
        .trim()
        .replace(/\s+as\s+\w+/, "")
        .trim(),
    )) {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        exports.push({ name, file });
      }
    }
  }

  return exports;
}

async function buildImportIndex(files) {
  // Count imports of each symbol across all files
  const importCounts = new Map();
  for (const f of files) {
    const c = await readFile(f, "utf8");
    // import { a, b, c as x } from "..."
    const re = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(c)) !== null) {
      for (const part of m[1].split(",")) {
        const name = part
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)[0]
          .trim();
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
          importCounts.set(name, (importCounts.get(name) ?? 0) + 1);
        }
      }
    }
    // import X from "..." (default or namespace)
    const reDefault = /import\s+(?:type\s+)?(\w+)\s+from\s+["']/g;
    while ((m = reDefault.exec(c)) !== null) {
      importCounts.set(m[1], (importCounts.get(m[1]) ?? 0) + 1);
    }
    // import * as X from "..."
    const reStar = /import\s+\*\s+as\s+(\w+)\s+from\s+["']/g;
    while ((m = reStar.exec(c)) !== null) {
      // namespace import -- we can't statically know which symbols are used
      // mark as wildcard for the file/module, but we don't have module context here
      // fallback: simple count bump that reduces false-positives is unsafe, skip
    }
  }
  return importCounts;
}

/** Eine Messung: tote Exporte, gruppiert nach Datei. Ohne Seiteneffekt. */
async function measure() {
  const allFiles = [];
  for (const d of SRC_DIRS) {
    allFiles.push(...(await walk(d)));
  }

  const importOnlyFiles = [];
  for (const d of IMPORT_ONLY_DIRS) {
    importOnlyFiles.push(...(await walk(d)));
  }

  const importCounts = await buildImportIndex([
    ...allFiles,
    ...importOnlyFiles,
  ]);

  const dead = [];
  for (const f of allFiles) {
    const c = await readFile(f, "utf8");
    const exports = extractExports(c, f);
    for (const e of exports) {
      if (!importCounts.has(e.name)) {
        dead.push(e);
      }
    }
  }

  // Group by file
  const byFile = new Map();
  for (const d of dead) {
    const rel = relative(ROOT, d.file).replace(/\\/g, "/");
    if (!byFile.has(rel)) byFile.set(rel, []);
    byFile.get(rel).push(d.name);
  }

  return { allFiles, importCounts, dead, byFile };
}

/**
 * Die Kennzahl-Zeile des Reports, so wie sie geschrieben und wieder gelesen
 * wird. Beide Richtungen an EINER Stelle, damit eine Umformulierung nicht
 * dazu führt, dass die Frischeprüfung stillschweigend nichts mehr findet.
 */
const COUNT_LINE = (n, files) =>
  `**${n} potenziell tote Exports** in ${files} Dateien.`;
const COUNT_RX = /\*\*(\d+) potenziell tote Exports\*\* in (\d+) Dateien\./;

async function main() {
  const { allFiles, importCounts, dead, byFile } = await measure();
  console.log(`Files: ${allFiles.length}`);
  console.log(`Unique imported symbols: ${importCounts.size}`);

  await mkdir(OUT_DIR, { recursive: true });

  const md = [];
  md.push(`# Dead-Exports-Report`);
  md.push(``);
  md.push(`_Generated: ${new Date().toISOString()}_`);
  md.push(``);
  md.push(
    `Static-Analyse findet \`export\`-Statements ohne matching \`import\` im Code. Heuristik, nicht vollstaendig:`,
  );
  md.push(``);
  md.push(`**Nicht erkannt**:`);
  md.push(`- \`import * as X\` Namespace-Imports (Symbole dahinter)`);
  md.push(`- Dynamic \`import()\` mit String-Template`);
  md.push(`- API-Nutzung per fetch / HTTP (externe Consumer)`);
  md.push(`- \`export default\` in Route/Page-Files (ignoriert)`);
  md.push(`- Vitest-Tests in tests/ (nicht im Scan)`);
  md.push(``);
  md.push(COUNT_LINE(dead.length, byFile.size));
  md.push(``);
  md.push(`## Top-20 Hot-Spots (>=3 dead exports)`);
  md.push(``);
  md.push(`| Datei | Anzahl | Exports |`);
  md.push(`|---|---|---|`);
  for (const [f, names] of [...byFile.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 40)) {
    if (names.length < 3) break;
    md.push(
      `| \`${f}\` | ${names.length} | ${names
        .slice(0, 10)
        .map((n) => "`" + n + "`")
        .join(", ")}${names.length > 10 ? " ..." : ""} |`,
    );
  }
  md.push(``);

  md.push(`## Alle Treffer (alphabetisch)`);
  md.push(``);
  for (const [f, names] of [...byFile.entries()].sort()) {
    md.push(`- \`${f}\` -- ${names.map((n) => "`" + n + "`").join(", ")}`);
  }
  md.push(``);

  // [OP-074] Der Report ist eingecheckt und faellt damit unter
  // `prettier --check .`. Der Generator schrieb bisher unformatiertes
  // Markdown: wer ihn laufen liess, machte das Format-Tor rot und musste das
  // erst merken. Er formatiert jetzt selbst, mit der Konfiguration des
  // Repositories — der Generatorlauf ist damit in sich abgeschlossen.
  const cfg = (await resolveConfig(OUT_MD)) ?? {};
  const text = await prettierFormat(md.join("\n"), {
    ...cfg,
    filepath: OUT_MD,
    parser: "markdown",
  });
  await writeFile(OUT_MD, text);
  console.log(`Dead exports: ${dead.length} in ${byFile.size} files`);
  console.log(`-> ${OUT_MD}`);
}

// ---------------------------------------------------------------------------
// Baseline schreiben (`--update-baseline`)
// ---------------------------------------------------------------------------
async function updateBaseline() {
  const { dead, byFile } = await measure();
  const counts = Object.fromEntries(
    [...byFile.entries()].sort().map(([f, names]) => [f, names.length]),
  );

  // Erstanlage ist keine Anhebung: es gibt keinen früheren Stand, gegen den
  // etwas steigen könnte. Ohne diese Unterscheidung verlangte die Ratsche für
  // ihre eigene Erzeugung eine Begründung — und die Begründung wäre inhaltsleer.
  const first = !existsSync(BASELINE);
  const previous = first
    ? { total: 0, files: 0, counts: {}, _history: [] }
    : JSON.parse(readFileSync(BASELINE, "utf8"));
  const prevCounts = previous.counts ?? {};

  // Wie bei der Lint-Ratsche: die gutartige Richtung (sinken) geht
  // kommentarlos, die andere nicht.
  const deltas = [];
  let raises = 0;
  for (const f of new Set([
    ...Object.keys(prevCounts),
    ...Object.keys(counts),
  ])) {
    const before = prevCounts[f] ?? 0;
    const after = counts[f] ?? 0;
    if (before === after) continue;
    if (after > before) raises += 1;
    deltas.push(`${f}: ${before} → ${after}`);
  }
  if ((previous.total ?? 0) < dead.length) raises += 1;

  const reasonIdx = argv.indexOf("--reason");
  const reason = reasonIdx !== -1 ? (argv[reasonIdx + 1] ?? "").trim() : "";
  if (!first && raises > 0 && !reason) {
    console.error(
      `✗ Die Zahl steigt (${previous.total ?? 0} → ${dead.length}) oder eine Datei legt zu:`,
    );
    for (const d of deltas.sort().slice(0, 40)) console.error(`    ${d}`);
    if (deltas.length > 40)
      console.error(`    … ${deltas.length - 40} weitere`);
    console.error(
      "\n  Eine Anhebung braucht eine Begründung in der Datei:\n" +
        '    node scripts/audit-dead-exports.mjs --update-baseline --reason "warum"\n' +
        "  Der übliche Weg ist nicht die Anhebung, sondern das Löschen des\n" +
        "  toten Exports.",
    );
    process.exit(1);
  }

  const history = Array.isArray(previous._history) ? previous._history : [];
  if (first) {
    history.push({
      date: new Date().toISOString().slice(0, 10),
      total: dead.length,
      files: byFile.size,
      changed: ["Erstanlage der Ratsche (OP-075)"],
    });
  } else if (deltas.length > 0) {
    history.push({
      date: new Date().toISOString().slice(0, 10),
      total: dead.length,
      files: byFile.size,
      changed: deltas.sort().slice(0, 200),
      ...(deltas.length > 200 ? { truncated: deltas.length - 200 } : {}),
      ...(reason ? { reason } : {}),
    });
  }

  // Prettier-formatiert geschrieben, nicht roh. `JSON.stringify(_, null, 2)`
  // bricht kurze Arrays anders um als prettier; `.eslint-ratchet.json` steht
  // deswegen in `.prettierignore`. Diese Ratsche braucht die Ausnahme nicht —
  // eine Datei, die das Format-Tor von sich aus besteht, kann auch nicht
  // dadurch durchfallen, dass jemand die Ignore-Liste anders aufruft (genau
  // das war der Fall beim CI-Schritt, siehe docs/UMSETZUNG-WELLE-4C.md §6).
  const baselineJson = JSON.stringify(
    {
      _comment:
        "[OP-075] Ratsche über scripts/audit-dead-exports.mjs. Zahlen dürfen nur " +
        "SINKEN. Geprüft mit `node scripts/audit-dead-exports.mjs --check`; neu " +
        "gesetzt mit `--update-baseline`. Eine Anhebung verlangt zusätzlich " +
        "--reason und wird in _history festgehalten. Die Datei liegt in der " +
        "Wurzel, nicht unter docs/, damit sie nicht wie in C-15/OP-066 durch " +
        "eine .gitignore-Regel aus dem Repository fällt; " +
        "scripts/check-gate-inputs.mjs prüft das.",
      _updatedAt: new Date().toISOString().slice(0, 10),
      total: dead.length,
      files: byFile.size,
      counts,
      _history: history,
    },
    null,
    2,
  );
  const baselineCfg = (await resolveConfig(BASELINE)) ?? {};
  await writeFile(
    BASELINE,
    await prettierFormat(baselineJson, {
      ...baselineCfg,
      filepath: BASELINE,
      parser: "json",
    }),
  );
  console.log(
    `Baseline geschrieben: ${BASELINE} (${dead.length} in ${byFile.size} Dateien)`,
  );
  if (deltas.length > 0) {
    console.log(
      `  ${deltas.length} Änderung(en) gegenüber der bisherigen Baseline.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Tor (`--check`)
// ---------------------------------------------------------------------------
async function check() {
  const { dead, byFile } = await measure();
  const failures = [];
  const improvements = [];

  // (0) Fail-closed: ohne Baseline gibt es nichts zu prüfen.
  if (!existsSync(BASELINE)) {
    console.error(
      `✗ ${BASELINE} fehlt — einmalig mit\n` +
        "    node scripts/audit-dead-exports.mjs --update-baseline\n" +
        "  erzeugen und EINCHECKEN. Ein Tor ohne Eingabe prüft nichts.",
    );
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const base = baseline.counts ?? {};

  // (1) Ratsche: Gesamtzahl.
  const baseTotal = baseline.total ?? 0;
  if (dead.length > baseTotal) {
    failures.push(
      `Gesamt: ${dead.length} tote Exporte > Baseline ${baseTotal} (+${dead.length - baseTotal}).`,
    );
  } else if (dead.length < baseTotal) {
    improvements.push(
      `Gesamt: ${dead.length} < Baseline ${baseTotal} (−${baseTotal - dead.length}).`,
    );
  }

  // (2) Ratsche je Datei — sonst versteckt sich ein neues Modul voller toter
  //     Exporte hinter dem Aufräumen eines anderen.
  for (const [f, names] of [...byFile.entries()].sort()) {
    const b = base[f];
    if (b === undefined) {
      failures.push(
        `${f}: ${names.length} tote Export(e), in der Baseline nicht vorhanden — ` +
          `${names.slice(0, 5).join(", ")}${names.length > 5 ? ", …" : ""}. ` +
          "Entfernen, nicht in die Ratsche aufnehmen.",
      );
    } else if (names.length > b) {
      failures.push(
        `${f}: ${names.length} > Baseline ${b} (+${names.length - b}).`,
      );
    } else if (names.length < b) {
      improvements.push(`${f}: ${names.length} < Baseline ${b}.`);
    }
  }
  for (const [f, b] of Object.entries(base)) {
    if (!byFile.has(f) && b > 0)
      improvements.push(`${f}: 0 < Baseline ${b} — vollständig.`);
  }

  // (3) [OP-074] Frische: der eingecheckte Report muss das Gemessene nennen.
  //     Fail-closed — fehlender Report oder unlesbare Kennzahl ist ein
  //     Fehler, kein Freibrief (#S08-26).
  if (!existsSync(OUT_MD)) {
    failures.push(
      `${relative(ROOT, OUT_MD)} fehlt. Erzeugen mit ` +
        "`node scripts/audit-dead-exports.mjs`.",
    );
  } else {
    const m = COUNT_RX.exec(readFileSync(OUT_MD, "utf8"));
    if (!m) {
      failures.push(
        `${relative(ROOT, OUT_MD)} enthält keine lesbare Kennzahl-Zeile ` +
          `(erwartet: "${COUNT_LINE("N", "M")}"). Der Reportaufbau hat sich ` +
          "geändert — diese Prüfung würde sonst stillschweigend nichts mehr messen.",
      );
    } else if (Number(m[1]) !== dead.length || Number(m[2]) !== byFile.size) {
      failures.push(
        `${relative(ROOT, OUT_MD)} nennt ${m[1]} tote Exporte in ${m[2]} Dateien, ` +
          `gemessen sind ${dead.length} in ${byFile.size}. Genau das war OP-074. ` +
          "Neu erzeugen: `node scripts/audit-dead-exports.mjs`.",
      );
    }
  }

  console.log(
    `Dead-Exports-Ratsche: ${dead.length} tote Exporte in ${byFile.size} Dateien ` +
      `(Baseline ${baseTotal} in ${baseline.files ?? 0}).`,
  );
  if (improvements.length) {
    console.log(
      `\n${improvements.length} Verbesserung(en) — bitte Baseline nachziehen ` +
        "(`--update-baseline`):",
    );
    for (const i of improvements.slice(0, 20)) console.log(`  ↓ ${i}`);
    if (improvements.length > 20)
      console.log(`  … ${improvements.length - 20} weitere`);
  }
  if (failures.length) {
    console.error(`\n✗ Dead-Exports-Tor verletzt (${failures.length}):`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log("\n✓ Keine Regression bei toten Exporten; Report ist aktuell.");
}

const run = CHECK ? check : UPDATE ? updateBaseline : main;
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
