#!/usr/bin/env node
// check-workflow-script-deps.mjs
//
// [ARCTOS-FULL-2026-08-31 · Welle 8g]
//
// DER BEFUND, DER DIESES SKRIPT AUSGELOEST HAT
//
// Der Job `i18n-parity` in `.github/workflows/i18n-coverage.yml` installierte
// keine Abhaengigkeiten — er brauchte lange keine. In Welle 8c bekam
// `scripts/audit-i18n-coverage.mjs` einen `prettier`-Import (OP-220, damit der
// eingecheckte Report nicht das Format-Gate rot macht). Von da an endete der
// Job mit `ERR_MODULE_NOT_FOUND`, noch bevor irgendetwas geprueft war — und
// der Schritt darunter, der auf Schluesselverlust prueft, lief nie.
//
// Die Aenderung war lokal richtig und im Job falsch, und nichts verband
// beides. Genau das prueft dieses Skript.
//
// WAS ES PRUEFT
//
// Fuer jeden Job in `.github/workflows/*.yml`:
//   1. Installiert der Job Abhaengigkeiten (`npm ci` / `npm install`)?
//   2. Welche Skripte aus `scripts/` ruft er auf?
//   3. Wenn NEIN zu (1): importiert eines dieser Skripte etwas anderes als
//      `node:`-Module und relative Pfade? Dann faellt der Job im CI, sobald
//      er laeuft — hier faellt es eine Stufe frueher auf.
//
// Bewusst grob: es liest die Importzeilen, nicht den Modulgraphen. Ein
// Skript, das ein anderes Repo-Skript importiert, das seinerseits ein Paket
// zieht, faellt durch dieses Raster. Das ist benannt, nicht behauptet — und
// die Klasse, die es faengt, ist die, die tatsaechlich aufgetreten ist.
//
// Aufruf: node scripts/check-workflow-script-deps.mjs

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const WF_DIR = join(ROOT, ".github/workflows");

/** Importierte Spezifizierer einer .mjs/.js-Datei, grob aus dem Quelltext. */
function importe(datei) {
  const text = readFileSync(datei, "utf8");
  const specs = new Set();
  for (const m of text.matchAll(/^\s*import\s[^"']*from\s*["']([^"']+)["']/gm))
    specs.add(m[1]);
  for (const m of text.matchAll(/^\s*import\s*["']([^"']+)["']/gm))
    specs.add(m[1]);
  for (const m of text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g))
    specs.add(m[1]);
  for (const m of text.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g))
    specs.add(m[1]);
  return [...specs];
}

const istEingebaut = (spec) =>
  spec.startsWith("node:") ||
  spec.startsWith(".") ||
  spec.startsWith("/") ||
  spec.startsWith("#");

/**
 * Job-Bloecke aus einer Workflow-Datei, ohne YAML-Parser: die Einrueckung
 * traegt die Struktur. `jobs:` auf Spalte 0, Jobnamen auf 2, alles darunter
 * gehoert zum Job.
 */
function jobs(text) {
  const zeilen = text.split("\n");
  const start = zeilen.findIndex((z) => /^jobs:\s*$/.test(z));
  if (start === -1) return [];
  const gefunden = [];
  let aktuell = null;
  for (let i = start + 1; i < zeilen.length; i++) {
    const z = zeilen[i];
    if (/^\S/.test(z) && z.trim() !== "") break; // Ende von jobs:
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(z);
    if (m) {
      if (aktuell) gefunden.push(aktuell);
      aktuell = { name: m[1], zeilen: [] };
      continue;
    }
    if (aktuell) aktuell.zeilen.push(z);
  }
  if (aktuell) gefunden.push(aktuell);
  return gefunden;
}

const befunde = [];
let geprueft = 0;

for (const datei of readdirSync(WF_DIR).filter((f) => /\.ya?ml$/.test(f))) {
  const text = readFileSync(join(WF_DIR, datei), "utf8");
  for (const job of jobs(text)) {
    const koerper = job.zeilen.join("\n");
    // Kommentarzeilen zaehlen nicht als Installation.
    const ohneKommentare = koerper.replace(/^\s*#.*$/gm, "");
    const installiert =
      /\bnpm\s+(ci|install|i)\b/.test(ohneKommentare) ||
      /\bpnpm\s+(install|i)\b/.test(ohneKommentare) ||
      /\byarn\s+install\b/.test(ohneKommentare);

    const skripte = new Set();
    for (const m of ohneKommentare.matchAll(
      /\b(?:node|npx tsx|tsx)\s+(scripts\/[\w.-]+\.(?:mjs|js|ts))/g,
    ))
      skripte.add(m[1]);

    if (skripte.size === 0) continue;
    geprueft++;
    if (installiert) continue;

    for (const rel of skripte) {
      const pfad = join(ROOT, rel);
      if (!existsSync(pfad)) {
        befunde.push(
          `${datei} · Job "${job.name}" ruft ${rel} — die Datei existiert nicht.`,
        );
        continue;
      }
      const fremd = importe(pfad).filter((s) => !istEingebaut(s));
      if (fremd.length > 0) {
        befunde.push(
          `${datei} · Job "${job.name}" installiert nichts, ruft aber ${rel},\n` +
            `      und das importiert: ${fremd.join(", ")}.\n` +
            "      Entweder der Job installiert (`npm ci --ignore-scripts`),\n" +
            "      oder das Skript kommt ohne Pakete aus. Ein stiller Rueckbau\n" +
            "      des Skripts ist die schlechtere Antwort — er nimmt eine\n" +
            "      Faehigkeit zurueck, statt die Luecke zu schliessen.",
        );
      }
    }
  }
}

console.log(
  `Workflow-Skripte: ${geprueft} Job(s) rufen Skripte aus scripts/ auf.`,
);

if (befunde.length > 0) {
  console.error(
    `\n✗ ${befunde.length} Job(s) rufen ein Skript, das dort nicht laufen kann:\n`,
  );
  for (const b of befunde) console.error(`  ✗ ${b}`);
  console.error(
    "\n  Ein Job, der an einem fehlenden Modul stirbt, hat NICHTS geprueft —\n" +
      "  und die Schritte darunter laufen gar nicht erst. Genau so ist der\n" +
      "  Schluesselverlust-Check aus Welle 8c nie zur Ausfuehrung gekommen.",
  );
  process.exit(1);
}

console.log(
  "\n✓ Jedes aufgerufene Skript kommt in seinem Job ohne fehlende Pakete aus.",
);
