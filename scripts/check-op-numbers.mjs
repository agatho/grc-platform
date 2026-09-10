#!/usr/bin/env node
// check-op-numbers.mjs
//
// [ARCTOS-FULL-2026-08-31 · Welle 8f]
//
// DER BEFUND, DER DIESES SKRIPT AUSGELOEST HAT
//
// Welle 8b hat im Protokoll und im Quelltext OP-218 und OP-219 vergeben, sie
// aber nicht ins Register eingetragen. Beim Schreiben des naechsten Nachtrags
// habe ich dieselben zwei Nummern an zwei ANDERE Punkte vergeben. Danach sagte
// der Kommentar in `hooks/use-module-config.tsx` etwas anderes ueber OP-218 als
// das Register — und beides klang richtig.
//
// Das Register ist die maßgebliche Liste. Eine Nummer, die nur im Protokoll und
// im Code steht, ist fuer den naechsten Schreiber unsichtbar; genau daraus ist
// die Kollision entstanden.
//
// WAS DIESES SKRIPT PRUEFT
//
//   1. Innerhalb EINER Tabelle kommt jede OP-Nummer hoechstens einmal vor.
//      Ueber Tabellen hinweg ist eine Wiederholung erlaubt und gewollt: die
//      Nachtraege schreiben den Stand eines Punktes fort ("behoben"), und
//      genau dafuer nennen sie ihn erneut. Zwei Zeilen in DERSELBEN Tabelle
//      sind dagegen immer zwei Punkte mit einem Namen.
//   2. Jede OP-Nummer, auf die irgendwo im Repository VERWIESEN wird (Code,
//      Protokolle, Skripte, CI), existiert im Register. Ein Verweis auf eine
//      Nummer, die es nicht gibt, ist entweder ein Tippfehler oder — wie hier —
//      ein Punkt, den nur der Verweis kennt.
//
// Beides ist billig zu pruefen und faengt die Klasse.
//
// Aufruf:
//   node scripts/check-op-numbers.mjs

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const REGISTER = "docs/OFFENE-PUNKTE-REGISTER.md";

const register = readFileSync(resolve(ROOT, REGISTER), "utf8");

// ── 1. Die vergebenen Nummern, tabellenweise ──────────────────────────────
//
// Eine Tabelle ist ein zusammenhaengender Block von Zeilen, die mit `|`
// beginnen. Eine Leerzeile oder eine Ueberschrift dazwischen beendet sie.
const vergeben = new Set(); // alle je vergebenen Nummern
const doppelt = []; // [Nummer, Zeilennummer der Wiederholung]

let inTabelle = new Map(); // Nummer → erste Zeilennummer in dieser Tabelle
const zeilen = register.split("\n");
for (let i = 0; i < zeilen.length; i++) {
  const z = zeilen[i];
  if (!z.startsWith("|")) {
    inTabelle = new Map();
    continue;
  }
  const m = /^\|\s*(OP-\d{3})\s*\|/.exec(z);
  if (!m) continue;
  vergeben.add(m[1]);
  if (inTabelle.has(m[1])) {
    doppelt.push([m[1], `Zeile ${i + 1}, zuvor ${inTabelle.get(m[1])}`]);
  } else {
    inTabelle.set(m[1], i + 1);
  }
}

// ── 2. Alle Verweise im Repository ────────────────────────────────────────
function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

const dateien = git(["ls-files"])
  .split("\n")
  .filter(Boolean)
  .filter((f) => /\.(ts|tsx|mjs|js|md|yml|yaml|sql|sh)$/.test(f))
  .filter((f) => f !== REGISTER);

const verweise = new Map(); // Nummer → Set(Datei)
for (const f of dateien) {
  let text;
  try {
    text = readFileSync(resolve(ROOT, f), "utf8");
  } catch {
    continue;
  }
  for (const m of text.matchAll(/\bOP-(\d{3})\b/g)) {
    const nr = `OP-${m[1]}`;
    if (!verweise.has(nr)) verweise.set(nr, new Set());
    verweise.get(nr).add(f);
  }
}

const unbekannt = [...verweise.entries()]
  .filter(([nr]) => !vergeben.has(nr))
  .sort();

// ── Ausgabe ───────────────────────────────────────────────────────────────
console.log(
  `OP-Nummern: ${vergeben.size} im Register, ${verweise.size} im ` +
    `Repository verwiesen (${dateien.length} Dateien gelesen).`,
);

let fehler = 0;

if (doppelt.length > 0) {
  fehler += doppelt.length;
  console.error(
    `\n✗ ${doppelt.length} Nummer(n) doppelt in DERSELBEN Tabelle:`,
  );
  for (const [nr, wo] of doppelt) console.error(`  ✗ ${nr} — ${wo}`);
  console.error(
    "\n  Zwei Zeilen mit derselben Nummer sind zwei Punkte mit einem Namen.\n" +
      "  Der aeltere Eintrag behaelt die Nummer; der juengere bekommt die\n" +
      "  naechste freie.",
  );
}

if (unbekannt.length > 0) {
  fehler += unbekannt.length;
  console.error(
    `\n✗ ${unbekannt.length} Nummer(n) werden verwiesen, stehen aber nicht im Register:`,
  );
  for (const [nr, files] of unbekannt) {
    const liste = [...files].sort().slice(0, 4);
    console.error(
      `  ✗ ${nr} — ${liste.join(", ")}${files.size > 4 ? ` (+${files.size - 4})` : ""}`,
    );
  }
  console.error(
    "\n  Eine Nummer, die nur im Protokoll und im Code steht, ist fuer den\n" +
      "  naechsten Schreiber unsichtbar — genau daraus ist die Kollision\n" +
      `  OP-218/OP-219 entstanden. Eintragen in ${REGISTER}.`,
  );
}

if (fehler > 0) process.exit(1);

console.log("\n✓ Keine doppelte und keine unbekannte OP-Nummer.");
