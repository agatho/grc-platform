#!/usr/bin/env node
// ============================================================================
// [ARCTOS-FULL-2026-08-31 · OP-253] Kein apt-Zugriff ohne abgeschaltete
// Fremdquellen
// ============================================================================
//
// Das ubuntu-latest-Image bringt Paketquellen mit, die dieses Projekt nicht
// braucht — allen voran Google Chrome. Rotiert deren Index gerade, beendet
// sich `apt-get update` mit 100 (`Hash Sum mismatch`), und unter `set -e` ist
// der Job tot, bevor ein Test laeuft. Am 2026-09-09 hat das im Lauf
// 34382535195 drei von vier Anlaeufen gekostet.
//
// Die Abhilfe ist die Action `.github/actions/apt-ohne-fremdquellen`. Sie
// stand an drei Stellen zu setzen — und drei Stellen sind eine Klasse. Diese
// Pruefung haelt fest, dass jeder JOB, der `apt-get` benutzt, sie vorher
// aufruft.
//
// `npx playwright install --with-deps` zaehlt mit: der Schalter ruft intern
// `apt-get install` auf, und genau dort ist der E2E-Job am 2026-09-09 zweimal
// gestorben.
// ============================================================================

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const VERZEICHNIS = ".github/workflows";
const ACTION = ".github/actions/apt-ohne-fremdquellen/action.yml";
const AUFRUF = "./.github/actions/apt-ohne-fremdquellen";

// Was als apt-Zugriff gilt. `apt-get update` allein reicht nicht als Muster:
// der Job stirbt auch an `install`, wenn die Indizes vorher nicht gezogen
// werden konnten.
const APT_MUSTER = [
  /\bapt-get\b/,
  /\bapt\s+install\b/,
  /playwright\s+install\b[^\n]*--with-deps/,
];

/** Zeilen eines Jobs in Reihenfolge, mit Zeilennummer. */
function jobZeilen(text) {
  const zeilen = text.split("\n");
  const jobs = new Map();
  let job = null;
  for (let i = 0; i < zeilen.length; i++) {
    const m = zeilen[i].match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (m) {
      job = m[1];
      jobs.set(job, []);
      continue;
    }
    if (job) jobs.get(job).push({ zeile: i + 1, text: zeilen[i] });
  }
  return jobs;
}

const befunde = [];
let jobsMitApt = 0;

// [OP-092-Klasse] Ohne die Action ist diese Pruefung sinnlos — und waere ohne
// diesen Block gruen, weil dann eben kein Job sie aufruft.
if (!existsSync(ACTION)) {
  console.error(
    `\n✗ ${ACTION} fehlt — ohne sie kann kein Job die Vorgabe erfuellen.\n`,
  );
  process.exit(1);
}

for (const datei of readdirSync(VERZEICHNIS).filter((f) =>
  /\.ya?ml$/.test(f),
)) {
  const pfad = join(VERZEICHNIS, datei);
  for (const [job, zeilen] of jobZeilen(readFileSync(pfad, "utf8"))) {
    const aptStellen = zeilen.filter((z) =>
      APT_MUSTER.some((re) => re.test(z.text)),
    );
    if (aptStellen.length === 0) continue;
    jobsMitApt++;

    const aufrufe = zeilen.filter((z) => z.text.includes(AUFRUF));
    if (aufrufe.length === 0) {
      befunde.push(
        `${pfad}: Job \`${job}\` benutzt apt (Zeile ${aptStellen[0].zeile}), ruft aber ` +
          `\`${AUFRUF}\` nicht auf. Ohne das stirbt der Job am Google-Chrome-Spiegel ` +
          `des Runner-Images, bevor ein Test laeuft (OP-253).`,
      );
      continue;
    }

    // Jede apt-Stelle braucht einen Aufruf VOR sich.
    const erster = aufrufe[0].zeile;
    for (const st of aptStellen) {
      if (st.zeile < erster) {
        befunde.push(
          `${pfad}: Job \`${job}\` benutzt apt in Zeile ${st.zeile}, ruft ` +
            `\`${AUFRUF}\` aber erst in Zeile ${erster} auf — zu spaet (OP-253).`,
        );
      }
    }
  }
}

console.log(`apt-Quellen: ${jobsMitApt} Job(s) greifen auf apt zu.`);
if (befunde.length > 0) {
  console.error("\n✗ apt-Zugriff ohne abgeschaltete Fremdquellen:\n");
  for (const b of befunde) console.error(`  - ${b}`);
  console.error("");
  process.exit(1);
}
console.log(`\n✓ Jeder apt-Zugriff schaltet vorher die Fremdquellen ab.`);
