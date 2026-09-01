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
//   node scripts/lint-ratchet.mjs --update   # Baseline neu setzen
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
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        _comment:
          "#S13-17 ESLint-Ratsche für apps/worker, packages/* und scripts/*. " +
          "Zahlen dürfen nur SINKEN. Neu setzen: node scripts/lint-ratchet.mjs --update. " +
          "apps/web hat eine eigene, strengere Konfiguration (WP12) und wird hier nicht gezählt.",
        _updatedAt: new Date().toISOString().slice(0, 10),
        _targets: TARGETS,
        counts: Object.fromEntries(
          Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
        ),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Baseline geschrieben: ${BASELINE}`);
  for (const [r, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${r}`);
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
