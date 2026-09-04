#!/usr/bin/env node
// ============================================================================
// #S13-17 (WP10) — ESLint über ALLE Workspaces, mit Ratsche.
//
// Vorher: `ci.yml:48-50` rief `npx eslint .` in `apps/web` auf. Von zwölf
// Workspaces definierte genau einer ein `lint`-Skript; `apps/worker` (132
// Dateien) und alle zehn Packages waren ungelintet. `turbo lint` hätte daran
// nichts geändert, weil es Workspaces ohne Task stillschweigend überspringt.
//
// Dieses Skript lintet ALLE zwölf Workspaces und vergleicht das Ergebnis mit
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
// ── [ARCTOS-FULL-2026-08-31 / Welle 4b-5 · OP-173] Zwei Bereiche ─────────
//
// Bis Welle 4b-5 zählte diese Ratsche `apps/worker`, `packages` und
// `scripts` — nicht `apps/web`, den GRÖSSTEN Workspace des Repositories
// (2.277 gelintete Dateien gegen 1.048 in allen anderen zusammen). Sein
// Bestand war damit als einziger nicht gedeckelt. Was nicht gezählt wird,
// wächst.
//
// Der Grund, aus dem er fehlte, ist mechanisch und nicht wegzuwünschen:
// ESLint sucht seine Flat Config vom ARBEITSVERZEICHNIS aus, nicht von der
// gelinteten Datei aufwärts. Ein `npx eslint apps/web` aus der Wurzel liefe
// deshalb gegen die Wurzelkonfiguration — und die ignoriert `apps/web/**`
// ausdrücklich, weil der Workspace seinen eigenen, strengeren Regelsatz hat
// (`apps/web/eslint.config.mjs`, WP12). Herausgekommen wäre die Zahl 0, und
// zwar eine falsche.
//
// Deshalb misst dieses Skript jetzt in ZWEI Läufen mit je eigenem
// Arbeitsverzeichnis (`SCOPES`) und hält die Zahlen GETRENNT. Zusammenzählen
// wäre der bekannte Fehler: ein Rückgang in `apps/worker` könnte einen
// Anstieg in `apps/web` decken, und die Ratsche bliebe grün, während der
// Bestand wächst. Eine Ratsche, die aufrechnet, ist keine.
//
// Ein Bereich, der aus `SCOPES` verschwindet, während er in der Baseline
// steht, ist selbst ein Befund — genau die Lage, die OP-173 beschreibt — und
// lässt die Prüfung fallen.
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

/**
 * Die gemessenen Bereiche. `cwd` ist relativ zur Repowurzel und bestimmt,
 * WELCHE Flat Config gilt — deshalb je Konfiguration ein eigener Eintrag.
 */
const SCOPES = [
  {
    name: "root",
    cwd: ".",
    targets: ["apps/worker", "packages", "scripts"],
    config: "eslint.config.mjs",
  },
  {
    name: "apps/web",
    cwd: "apps/web",
    targets: ["."],
    config: "apps/web/eslint.config.mjs",
  },
];

/** Ein ESLint-Lauf in `scope.cwd`; liefert Zähler je Regel. */
function measure(scope) {
  let raw;
  try {
    raw = execFileSync(
      "npx",
      [
        "eslint",
        ...scope.targets,
        "--no-error-on-unmatched-pattern",
        "-f",
        "json",
      ],
      {
        cwd: join(ROOT, scope.cwd),
        encoding: "utf8",
        maxBuffer: 256 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (e) {
    // eslint exitet 1, sobald ein Error gemeldet wird — stdout ist gültiges JSON.
    raw = e.stdout;
    if (!raw || !raw.trim().startsWith("[")) {
      console.error(
        `✗ ESLint konnte in "${scope.cwd}" nicht ausgeführt werden:`,
      );
      console.error(e.stderr || e.message);
      process.exit(2);
    }
  }

  const results = JSON.parse(raw);
  const counts = {};
  const fatals = [];
  for (const file of results) {
    for (const m of file.messages) {
      if (m.fatal) fatals.push(`${file.filePath}:${m.line} ${m.message}`);
      const rule = m.ruleId ?? "(fatal-or-directive)";
      counts[rule] = (counts[rule] ?? 0) + 1;
    }
  }
  return { counts, files: results.length, fatals };
}

const measured = {};
let fatalTotal = 0;
for (const scope of SCOPES) {
  const m = measure(scope);
  measured[scope.name] = m;
  if (m.fatals.length) {
    fatalTotal += m.fatals.length;
    console.error(
      `✗ ${m.fatals.length} fatale Parse-Fehler in "${scope.name}" — ESLint konnte Dateien nicht lesen.`,
    );
    for (const f of m.fatals) console.error(`  ✗ ${f.replace(ROOT + "/", "")}`);
  }
}
if (fatalTotal) process.exit(1);

// ---------------------------------------------------------------------------
// Baseline lesen. Zwei Formate werden verstanden:
//
//   alt  (bis Welle 4b-4):  { "_targets": [...], "counts": { regel: n } }
//   neu  (ab  Welle 4b-5):  { "_scopes": {...},  "counts": { bereich: { regel: n } } }
//
// Das alte Format wird als Bereich "root" gelesen, damit die Prüfung auf
// einem nicht nachgezogenen Stand nicht stillschweigend alles durchwinkt.
// ---------------------------------------------------------------------------
function readBaseline() {
  if (!existsSync(BASELINE)) return null;
  const parsed = JSON.parse(readFileSync(BASELINE, "utf8"));
  const counts = parsed.counts ?? {};
  const istAlt = Object.values(counts).some((v) => typeof v === "number");
  if (istAlt) {
    return {
      raw: parsed,
      legacy: true,
      byScope: { root: counts },
    };
  }
  return { raw: parsed, legacy: false, byScope: counts };
}

if (UPDATE) {
  // [ARCTOS-FULL-2026-08-31 · OP-064] Eine Ratsche, die man beim Reissen
  // höher stellt, ist keine Ratsche. Vor diesem Nachtrag konnte `--update`
  // jede Zahl kommentarlos anheben und die einzige Spur davon war ein
  // geändertes Datum. Jetzt gilt:
  //
  //   - Sinken darf jede Zahl ohne Begründung.
  //   - **Steigt** eine Zahl, kommt eine Regel neu hinzu ODER verschwindet
  //     ein gemessener Bereich, verlangt `--update` ein `--reason "..."`,
  //     und die Begründung landet mitsamt den Deltas in `_history` — in der
  //     Datei, im Diff, im Review.
  //
  // `_history` wird beim Schreiben übernommen, damit die Kette hält.
  const previous = readBaseline() ?? { raw: { _history: [] }, byScope: {} };

  const deltas = [];
  let raises = 0;
  for (const scope of SCOPES) {
    const before = previous.byScope[scope.name] ?? {};
    const after = measured[scope.name].counts;
    for (const rule of new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ])) {
      const b = before[rule] ?? 0;
      const a = after[rule] ?? 0;
      if (b === a) continue;
      if (a > b) raises += 1;
      deltas.push(`${scope.name} · ${rule}: ${b} → ${a}`);
    }
  }
  // Ein Bereich, der aus der Messung fällt: dieselbe Wirkung wie eine
  // Anhebung auf unendlich, deshalb begründungspflichtig.
  for (const name of Object.keys(previous.byScope)) {
    if (!SCOPES.some((s) => s.name === name)) {
      raises += 1;
      deltas.push(`${name}: Bereich wird nicht mehr gemessen (ENTFERNT)`);
    }
  }
  // Ein NEU aufgenommener Bereich ist eine Verschärfung und braucht keine
  // Begründung — er gehört aber in `_history`, sonst ist die grösste
  // Änderung an dieser Datei die einzige ohne Spur.
  for (const scope of SCOPES) {
    if (!(scope.name in previous.byScope)) {
      const summe = Object.values(measured[scope.name].counts).reduce(
        (a, b) => a + b,
        0,
      );
      deltas.push(
        `${scope.name}: Bereich NEU aufgenommen (${summe} Befunde, ` +
          `${measured[scope.name].files} Dateien)`,
      );
    }
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

  const history = Array.isArray(previous.raw._history)
    ? previous.raw._history
    : [];
  const gesamt = SCOPES.reduce(
    (a, s) =>
      a + Object.values(measured[s.name].counts).reduce((x, y) => x + y, 0),
    0,
  );
  if (deltas.length > 0) {
    history.push({
      date: new Date().toISOString().slice(0, 10),
      total: gesamt,
      changed: deltas.sort(),
      ...(reason ? { reason } : {}),
    });
  }

  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        _comment:
          "#S13-17 ESLint-Ratsche über alle zwölf Workspaces, getrennt nach " +
          "Bereich (je Bereich eine eigene Flat Config, siehe _scopes). " +
          "Zahlen dürfen nur SINKEN, und sie werden NICHT über Bereiche " +
          "hinweg aufgerechnet. Neu setzen: node scripts/lint-ratchet.mjs " +
          "--update. Eine Anhebung — oder das Entfernen eines Bereichs — " +
          "verlangt zusätzlich --reason und wird in _history festgehalten.",
        _updatedAt: new Date().toISOString().slice(0, 10),
        _scopes: Object.fromEntries(
          SCOPES.map((s) => [
            s.name,
            { cwd: s.cwd, targets: s.targets, config: s.config },
          ]),
        ),
        counts: Object.fromEntries(
          SCOPES.map((s) => [
            s.name,
            Object.fromEntries(
              Object.entries(measured[s.name].counts).sort(([a], [b]) =>
                a.localeCompare(b),
              ),
            ),
          ]),
        ),
        _history: history,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Baseline geschrieben: ${BASELINE}`);
  for (const s of SCOPES) {
    const c = measured[s.name].counts;
    const summe = Object.values(c).reduce((a, b) => a + b, 0);
    console.log(
      `  [${s.name}] ${summe} Befunde, ${measured[s.name].files} Dateien`,
    );
    for (const [r, n] of Object.entries(c).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(5)}  ${r}`);
    }
  }
  if (deltas.length > 0) {
    console.log("  Änderungen gegenüber der bisherigen Baseline:");
    for (const d of deltas.sort()) console.log(`    ${d}`);
  }
  process.exit(0);
}

const baselineDoc = readBaseline();
if (!baselineDoc) {
  console.error(
    `✗ ${BASELINE} fehlt — einmalig mit \`node scripts/lint-ratchet.mjs --update\` erzeugen.`,
  );
  process.exit(1);
}

const failures = [];
const improvements = [];

// Ein Bereich, der in der Baseline steht, aber nicht mehr gemessen wird, ist
// der Befund selbst (OP-173). Er fällt hier auf, nicht erst beim nächsten
// `--update`.
for (const name of Object.keys(baselineDoc.byScope)) {
  if (!SCOPES.some((s) => s.name === name)) {
    failures.push(
      `Bereich "${name}" steht in der Baseline, wird aber nicht mehr gemessen. ` +
        `Ein entfernter Bereich ist kein Rückgang auf 0 — er ist eine ` +
        `abgeschaltete Messung (OP-173).`,
    );
  }
}
if (baselineDoc.legacy) {
  failures.push(
    `${BASELINE} steht noch im alten, bereichslosen Format. Der Bestand von ` +
      `${SCOPES.filter((s) => s.name !== "root")
        .map((s) => s.name)
        .join(", ")} wäre damit ungedeckelt. Einmalig mit ` +
      `\`node scripts/lint-ratchet.mjs --update\` nachziehen.`,
  );
}

console.log("Lint-Ratsche:");
for (const scope of SCOPES) {
  const counts = measured[scope.name].counts;
  const base = baselineDoc.byScope[scope.name] ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const baseTotal = Object.values(base).reduce((a, b) => a + b, 0);
  console.log(
    `  [${scope.name}] ${scope.targets.join(", ")} (cwd ${scope.cwd}, ${scope.config}): ` +
      `${total} Befunde (Baseline ${baseTotal}), ${measured[scope.name].files} Dateien.`,
  );
  if (!(scope.name in baselineDoc.byScope)) {
    failures.push(
      `Bereich "${scope.name}" fehlt in der Baseline — mit \`--update\` aufnehmen, ` +
        `sonst ist sein Bestand nicht gedeckelt (OP-173).`,
    );
    continue;
  }
  for (const [rule, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(
      `    ${String(n).padStart(5)}  ${rule}  (Baseline ${base[rule] ?? 0})`,
    );
  }
  for (const [rule, n] of Object.entries(counts)) {
    const b = base[rule];
    if (b === undefined) {
      failures.push(
        `${scope.name} · Neue Regelverletzung "${rule}" (${n}×) — in der Baseline ` +
          `nicht vorhanden. Beheben, nicht in die Ratsche aufnehmen.`,
      );
    } else if (n > b) {
      failures.push(
        `${scope.name} · ${rule}: ${n} > Baseline ${b} (+${n - b}).`,
      );
    } else if (n < b) {
      improvements.push(
        `${scope.name} · ${rule}: ${n} < Baseline ${b} (−${b - n}).`,
      );
    }
  }
  for (const [rule, b] of Object.entries(base)) {
    if (!(rule in counts) && b > 0)
      improvements.push(
        `${scope.name} · ${rule}: 0 < Baseline ${b} — vollständig behoben.`,
      );
  }
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
