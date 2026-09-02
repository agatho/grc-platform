#!/usr/bin/env node
// ============================================================================
// #S13-17 (WP10) — ESLint über ALLE Workspaces, mit Ratsche.
//
// Vorher: `ci.yml:48-50` rief `npx eslint .` in `apps/web` auf. Von zwölf
// Workspaces definierte genau einer ein `lint`-Skript; `apps/worker` (132
// Dateien) und alle zehn Packages waren ungelintet. `turbo lint` hätte daran
// nichts geändert, weil es Workspaces ohne Task stillschweigend überspringt.
//
// Dieses Skript lintet die elf Nicht-Web-Workspaces gegen die neue
// Basis-Konfiguration `eslint.config.mjs` und vergleicht das Ergebnis mit
// `.eslint-ratchet.json`:
//
//   - Steigt die Zahl der Verstösse einer Regel → FEHLER.
//   - Taucht eine Regel auf, die in der Baseline nicht vorkommt → FEHLER
//     (eine neue Defektklasse darf nicht lautlos einziehen).
//   - Sinkt eine Zahl → Hinweis, die Baseline gehört nachgezogen
//     (`--update`), sonst schützt sie den erreichten Stand nicht.
//
// Der Altbestand (Stand 2026-09-01: 253 ungenutzte Bindungen, 121
// `console.*` am strukturierten Logger vorbei, 33 `any`) wird damit
// eingefroren statt per `off` unsichtbar gemacht — das war ausdrücklich der
// Vorwurf aus S14-19 an die frühere `apps/web`-Konfiguration.
//
// Aufruf:
//   node scripts/lint-ratchet.mjs            # prüfen (CI)
//   node scripts/lint-ratchet.mjs --update   # Baseline senken
//   node scripts/lint-ratchet.mjs --update --reason "…"   # Baseline anheben
//
// Eine Anhebung ohne `--reason` wird abgelehnt; die Begründung wird mit den
// Deltas in `_history` festgehalten (OP-064).
// ============================================================================
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const BASELINE = join(ROOT, ".eslint-ratchet.json");
const UPDATE = process.argv.includes("--update");
const TARGETS = ["apps/worker", "packages", "scripts"];

let raw;
try {
  raw = execFileSync(
    "npx",
    ["eslint", ...TARGETS, "--no-error-on-unmatched-pattern", "-f", "json"],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
} catch (e) {
  // eslint exitet 1, sobald ein Error gemeldet wird — stdout ist gültiges JSON.
  raw = e.stdout;
  if (!raw || !raw.trim().startsWith("[")) {
    console.error("✗ ESLint konnte nicht ausgeführt werden:");
    console.error(e.stderr || e.message);
    process.exit(2);
  }
}

const results = JSON.parse(raw);
const counts = {};
let fatal = 0;
for (const file of results) {
  if (file.fatalErrorCount) fatal += file.fatalErrorCount;
  for (const m of file.messages) {
    const rule = m.ruleId ?? "(fatal-or-directive)";
    counts[rule] = (counts[rule] ?? 0) + 1;
  }
}

if (fatal) {
  console.error(
    `✗ ${fatal} fatale Parse-Fehler — ESLint konnte Dateien nicht lesen.`,
  );
  for (const f of results) {
    for (const m of f.messages) {
      if (m.fatal)
        console.error(
          `  ✗ ${f.filePath.replace(ROOT + "/", "")}:${m.line} ${m.message}`,
        );
    }
  }
  process.exit(1);
}

if (UPDATE) {
  // [ARCTOS-FULL-2026-08-31 · OP-064] Eine Ratsche, die man beim Reissen
  // höher stellt, ist keine Ratsche. Vor diesem Nachtrag konnte `--update`
  // jede Zahl kommentarlos anheben und die einzige Spur davon war ein
  // geändertes Datum. Jetzt gilt:
  //
  //   - Sinken darf jede Zahl ohne Begründung.
  //   - **Steigt** eine Zahl oder kommt eine Regel neu hinzu, verlangt
  //     `--update` ein `--reason "..."`, und die Begründung landet mitsamt
  //     den Deltas in `_history` — in der Datei, im Diff, im Review.
  //
  // `_history` wird beim Schreiben übernommen, damit die Kette hält.
  const previous = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, "utf8"))
    : { counts: {}, _history: [] };
  const prevCounts = previous.counts ?? {};

  const deltas = [];
  let raises = 0;
  for (const rule of new Set([
    ...Object.keys(prevCounts),
    ...Object.keys(counts),
  ])) {
    const before = prevCounts[rule] ?? 0;
    const after = counts[rule] ?? 0;
    if (before === after) continue;
    if (after > before) raises += 1;
    deltas.push(`${rule}: ${before} → ${after}`);
  }

  const reasonIdx = process.argv.indexOf("--reason");
  const reason =
    reasonIdx !== -1 ? (process.argv[reasonIdx + 1] ?? "").trim() : "";

  if (raises > 0 && !reason) {
    console.error(
      `✗ ${raises} Zahl(en) steigen gegenüber der bisherigen Baseline:`,
    );
    for (const d of deltas) console.error(`    ${d}`);
    console.error(
      "\n  Eine Anhebung braucht eine Begründung in der Datei:\n" +
        '    node scripts/lint-ratchet.mjs --update --reason "warum das jetzt so ist"\n' +
        "  Der übliche Weg ist nicht die Anhebung, sondern der Befund.",
    );
    process.exit(1);
  }

  const history = Array.isArray(previous._history) ? previous._history : [];
  if (deltas.length > 0) {
    history.push({
      date: new Date().toISOString().slice(0, 10),
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      changed: deltas.sort(),
      ...(reason ? { reason } : {}),
    });
  }

  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        _comment:
          "#S13-17 ESLint-Ratsche für apps/worker, packages/* und scripts/*. " +
          "Zahlen dürfen nur SINKEN. Neu setzen: node scripts/lint-ratchet.mjs --update. " +
          "Eine Anhebung verlangt zusätzlich --reason und wird in _history festgehalten. " +
          "apps/web hat eine eigene, strengere Konfiguration (WP12) und wird hier nicht gezählt.",
        _updatedAt: new Date().toISOString().slice(0, 10),
        _targets: TARGETS,
        counts: Object.fromEntries(
          Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
        ),
        _history: history,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Baseline geschrieben: ${BASELINE}`);
  for (const [r, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${r}`);
  }
  if (deltas.length > 0) {
    console.log("  Änderungen gegenüber der bisherigen Baseline:");
    for (const d of deltas.sort()) console.log(`    ${d}`);
  }
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(
    `✗ ${BASELINE} fehlt — einmalig mit \`node scripts/lint-ratchet.mjs --update\` erzeugen.`,
  );
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8")).counts ?? {};
const failures = [];
const improvements = [];

for (const [rule, n] of Object.entries(counts)) {
  const base = baseline[rule];
  if (base === undefined) {
    failures.push(
      `Neue Regelverletzung "${rule}" (${n}×) — in der Baseline nicht vorhanden. ` +
        `Beheben, nicht in die Ratsche aufnehmen.`,
    );
  } else if (n > base) {
    failures.push(`${rule}: ${n} > Baseline ${base} (+${n - base}).`);
  } else if (n < base) {
    improvements.push(`${rule}: ${n} < Baseline ${base} (−${base - n}).`);
  }
}
for (const [rule, base] of Object.entries(baseline)) {
  if (!(rule in counts) && base > 0)
    improvements.push(`${rule}: 0 < Baseline ${base} — vollständig behoben.`);
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
console.log(
  `Lint-Ratsche über ${TARGETS.join(", ")}: ${total} Befunde (Baseline ${baseTotal}), ` +
    `${results.length} Dateien.`,
);
for (const [r, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(
    `  ${String(n).padStart(5)}  ${r}  (Baseline ${baseline[r] ?? 0})`,
  );
}

if (improvements.length) {
  console.log("\nVerbesserungen — bitte Baseline nachziehen (`--update`):");
  for (const i of improvements) console.log(`  ↓ ${i}`);
}
if (failures.length) {
  console.error(`\n✗ Lint-Ratsche verletzt (${failures.length}):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\n✓ Keine Lint-Regression.");
