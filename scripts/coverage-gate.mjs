#!/usr/bin/env node
// ============================================================================
// #S13-25 (WP10) — Coverage-Gate mit Ratsche.
//
// Vorher: `coverage.yml` erzeugte einen Report und kommentierte ihn am PR,
// setzte aber KEINE Mindestabdeckung durch und blockierte dank
// `continue-on-error: true` auch bei komplett fehlgeschlagenen Tests nicht.
// Ein Qualitätsgate, das nicht failen kann, ist kein Gate.
//
// Dieses Skript wertet `coverage/aggregated-summary.json` aus (erzeugt von
// scripts/coverage-aggregate.ts, WP11-Hoheit) und failt, wenn
//
//   (a) die Gesamtabdeckung unter die eingecheckte Baseline fällt
//       (`.coverage-ratchet.json`) — Ratsche, kein Rückschritt; oder
//   (b) die Gesamtabdeckung unter den harten Boden `--floor` fällt; oder
//   (c) ein Paket, das eine Baseline hat, aus dem Report verschwindet
//       (sonst liesse sich das Gate durch Löschen der Testdateien passieren).
//
// Die Baseline wird bewusst NICHT automatisch angehoben — `--update-baseline`
// ist ein ausdrücklicher, im Diff sichtbarer Schritt. Eine ABSENKUNG verlangt
// zusätzlich `--reason` und wird mit den Deltas in `_history` festgehalten
// (OP-067).
//
// Aufruf:
//   node scripts/coverage-gate.mjs [--floor 20] [--tolerance 0.5]
//   node scripts/coverage-gate.mjs --update-baseline
//   node scripts/coverage-gate.mjs --update-baseline --reason "…"   # absenken
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const SUMMARY = join(ROOT, "coverage", "aggregated-summary.json");

// [ARCTOS-FULL-2026-08-31 · OP-066/OP-067] Die Baseline lag bis hierher unter
// `.coverage-ratchet.json` — also **in** dem Verzeichnis, das
// definitionsgemäss Bauausgabe ist. `.gitignore` nahm sie in Zeile 23 aus,
// aber die Zeilen 78/79 (`coverage/`, `**/coverage/`) stehen weiter unten und
// die zuletzt passende Regel gewinnt; ein ausgeschlossenes Verzeichnis lässt
// sich nicht über eine Datei darin wieder einschliessen. Die Datei war damit
// nie im Repository — `git log` auf sie ist leer, auch vor dem Audit. Wirkung:
// der Schritt „Coverage ratchet" in `.github/workflows/coverage.yml` traf in
// jedem CI-Lauf auf `!existsSync(BASELINE)` und beendete sich mit 1. Das Tor
// war nicht zu locker, es war dauerhaft rot.
//
// Das ist dieselbe Fehlerklasse wie C-15 (drei API-Routen aus dem Repository
// verschwunden). Eine dritte Ausnahme in dieselbe `.gitignore` zu schreiben
// hiesse, die Klasse ein drittes Mal zu bedienen. Die Ratsche zieht deshalb
// dorthin um, wo die Lint-Ratsche schon steht: in die Wurzel, ausserhalb jedes
// Artefaktverzeichnisses.
const BASELINE = join(ROOT, ".coverage-ratchet.json");

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 ? Number(argv[i + 1]) : dflt;
};
const UPDATE = argv.includes("--update-baseline");
// Toleranz gegen Mess-Rauschen (unterschiedliche Runner-Timings können
// asynchrone Pfade minimal verschieben). Bewusst klein.
const TOLERANCE = arg("--tolerance", 0.5);
const FLOOR = arg("--floor", null);

if (!existsSync(SUMMARY)) {
  console.error(
    `✗ ${SUMMARY} fehlt. Erst \`npm run test:coverage\` und ` +
      `\`npx tsx scripts/coverage-aggregate.ts\` ausführen.`,
  );
  process.exit(1);
}

const summary = JSON.parse(readFileSync(SUMMARY, "utf8"));
const METRICS = ["lines", "statements", "functions", "branches"];

const current = {
  totals: Object.fromEntries(
    METRICS.map((m) => [m, summary.totals?.[m]?.pct ?? 0]),
  ),
  packages: Object.fromEntries(
    (summary.perPackage ?? []).map((p) => [
      p.name,
      Object.fromEntries(METRICS.map((m) => [m, p[m]?.pct ?? 0])),
    ]),
  ),
};

if (UPDATE) {
  // [ARCTOS-FULL-2026-08-31 · OP-067] Wie bei der Lint-Ratsche: die gutartige
  // Richtung geht kommentarlos, die andere nicht. Hier ist die gutartige das
  // **Anheben** — eine höhere Baseline ist strenger. Eine ABSENKUNG braucht
  // `--reason`, und die Begründung landet mit den Deltas in `_history`. Ohne
  // das wäre die Ratsche ein Vorschlag: wer sie reisst, ruft `--update-baseline`
  // und die einzige Spur ist ein geändertes Datum.
  const previous = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, "utf8"))
    : { totals: {}, packages: {}, _history: [] };

  const drops = [];
  const changes = [];
  for (const m of METRICS) {
    const before = previous.totals?.[m];
    const after = current.totals[m];
    if (before === undefined || Math.abs(before - after) < 0.005) continue;
    const line = `total ${m}: ${before.toFixed(2)} % → ${after.toFixed(2)} %`;
    changes.push(line);
    if (after < before) drops.push(line);
  }
  for (const [pkg, metrics] of Object.entries(previous.packages ?? {})) {
    if (!(pkg in current.packages)) {
      drops.push(`${pkg}: liefert keine Coverage-Daten mehr`);
      changes.push(`${pkg}: liefert keine Coverage-Daten mehr`);
      continue;
    }
    for (const m of METRICS) {
      const before = metrics[m];
      const after = current.packages[pkg][m];
      if (before === undefined || Math.abs(before - after) < 0.005) continue;
      const line = `${pkg} ${m}: ${before.toFixed(2)} % → ${after.toFixed(2)} %`;
      changes.push(line);
      if (after < before) drops.push(line);
    }
  }

  const reasonIdx = argv.indexOf("--reason");
  const reason = reasonIdx !== -1 ? (argv[reasonIdx + 1] ?? "").trim() : "";

  if (drops.length > 0 && !reason) {
    console.error(
      `✗ ${drops.length} Wert(e) sinken gegenüber der bisherigen Baseline:`,
    );
    for (const d of drops) console.error(`    ${d}`);
    console.error(
      "\n  Eine Absenkung braucht eine Begründung in der Datei:\n" +
        '    node scripts/coverage-gate.mjs --update-baseline --reason "warum"\n' +
        "  Der übliche Weg ist nicht die Absenkung, sondern der fehlende Test.",
    );
    process.exit(1);
  }

  const history = Array.isArray(previous._history) ? previous._history : [];
  if (changes.length > 0) {
    history.push({
      date: new Date().toISOString().slice(0, 10),
      totals: Object.fromEntries(
        METRICS.map((m) => [m, Number(current.totals[m].toFixed(2))]),
      ),
      changed: changes.sort(),
      ...(reason ? { reason } : {}),
    });
  }

  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        _comment:
          "#S13-25 Coverage-Ratsche. Von scripts/coverage-gate.mjs geprüft. " +
          "Werte dürfen nur STEIGEN. Neu setzen über " +
          "`node scripts/coverage-gate.mjs --update-baseline` in einem eigenen, " +
          "begründeten Commit; eine Absenkung verlangt zusätzlich --reason und " +
          "wird in _history festgehalten.",
        _updatedAt: new Date().toISOString().slice(0, 10),
        ...current,
        _history: history,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Baseline geschrieben: ${BASELINE}`);
  for (const m of METRICS)
    console.log(`  ${m}: ${current.totals[m].toFixed(2)} %`);
  if (changes.length > 0) {
    console.log("  Änderungen gegenüber der bisherigen Baseline:");
    for (const c of changes) console.log(`    ${c}`);
  }
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(
    `✗ ${BASELINE} fehlt — einmalig mit \`node scripts/coverage-gate.mjs ` +
      `--update-baseline\` erzeugen und einchecken.`,
  );
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const failures = [];

console.log("Coverage-Gate (Ratsche gegen .coverage-ratchet.json)");
console.log("  Metrik        Baseline   Aktuell   Δ");
for (const m of METRICS) {
  const base = baseline.totals?.[m] ?? 0;
  const cur = current.totals[m];
  const d = cur - base;
  console.log(
    `  ${m.padEnd(12)} ${base.toFixed(2).padStart(7)} % ${cur.toFixed(2).padStart(7)} % ${
      (d >= 0 ? "+" : "") + d.toFixed(2)
    }`,
  );
  if (cur < base - TOLERANCE) {
    failures.push(
      `Gesamt-${m}: ${cur.toFixed(2)} % liegt unter der Baseline ${base.toFixed(2)} % ` +
        `(Toleranz ${TOLERANCE}). Tests ergänzen oder die Regression beheben.`,
    );
  }
  if (FLOOR != null && cur < FLOOR) {
    failures.push(
      `Gesamt-${m}: ${cur.toFixed(2)} % liegt unter dem harten Boden ${FLOOR} %.`,
    );
  }
}

for (const [pkg, metrics] of Object.entries(baseline.packages ?? {})) {
  if (!(pkg in current.packages)) {
    failures.push(
      `Paket "${pkg}" hat eine Baseline, liefert aber keine Coverage-Daten mehr. ` +
        `Ein Paket darf nicht stillschweigend aus der Messung verschwinden ` +
        `(#S13-17: --passWithNoTests hält CI grün, wenn Testdateien gelöscht werden).`,
    );
    continue;
  }
  for (const m of METRICS) {
    const base = metrics[m] ?? 0;
    const cur = current.packages[pkg][m];
    if (cur < base - TOLERANCE) {
      failures.push(
        `${pkg} ${m}: ${cur.toFixed(2)} % < Baseline ${base.toFixed(2)} % (Toleranz ${TOLERANCE}).`,
      );
    }
  }
}

if (summary.missingPackages?.length) {
  console.log(
    `\nHinweis: ohne Coverage-Daten: ${summary.missingPackages.join(", ")}`,
  );
}

if (failures.length) {
  console.error(`\n✗ Coverage-Gate fehlgeschlagen (${failures.length}):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  "\n✓ Coverage-Gate bestanden — keine Regression gegenüber der Baseline.",
);
