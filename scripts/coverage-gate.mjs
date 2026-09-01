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
//       (`coverage/coverage-baseline.json`) — Ratsche, kein Rückschritt; oder
//   (b) die Gesamtabdeckung unter den harten Boden `--floor` fällt; oder
//   (c) ein Paket, das eine Baseline hat, aus dem Report verschwindet
//       (sonst liesse sich das Gate durch Löschen der Testdateien passieren).
//
// Die Baseline wird bewusst NICHT automatisch angehoben — `--update-baseline`
// ist ein ausdrücklicher, im Diff sichtbarer Schritt.
//
// Aufruf:
//   node scripts/coverage-gate.mjs [--floor 20] [--tolerance 0.5]
//   node scripts/coverage-gate.mjs --update-baseline
// ============================================================================
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const SUMMARY = join(ROOT, "coverage", "aggregated-summary.json");
const BASELINE = join(ROOT, "coverage", "coverage-baseline.json");

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
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        _comment:
          "#S13-25 Coverage-Ratsche. Von scripts/coverage-gate.mjs geprüft. " +
          "Werte dürfen nur STEIGEN. Anheben ausschließlich über " +
          "`node scripts/coverage-gate.mjs --update-baseline` in einem eigenen, " +
          "begründeten Commit.",
        _updatedAt: new Date().toISOString().slice(0, 10),
        ...current,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Baseline geschrieben: ${BASELINE}`);
  for (const m of METRICS)
    console.log(`  ${m}: ${current.totals[m].toFixed(2)} %`);
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

console.log("Coverage-Gate (Ratsche gegen coverage/coverage-baseline.json)");
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
