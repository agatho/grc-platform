#!/usr/bin/env node
// op-index.mjs
//
// [ARCTOS-FULL-2026-08-31 · Welle 8h]
//
// DER BEFUND, DER DIESES SKRIPT AUSGELOEST HAT
//
// Zweimal an einem Tag habe ich aus `docs/OFFENE-PUNKTE-REGISTER.md` die
// falsche Antwort auf die einfachste Frage gezogen, die es an ein Register
// gibt: WELCHE PUNKTE SIND OFFEN?
//
//   * Einmal, weil ich die letzte Fundstelle einer Nummer fuer die neueste
//     hielt (die Nachtraege werden oben eingefuegt, also ist es die erste).
//   * Und einmal, weil auch das nicht stimmt: der Nachtrag an Zeile 566 ist
//     auf 2026-09-03 datiert und steht ueber Nachtraegen vom 2026-09-09.
//     Die Datei ist NICHT durchgehend neueste-zuerst sortiert.
//
// Ergebnis: ich habe dem Eigentuemer fuenf Punkte als offen gemeldet
// (OP-175, 176, 177, 179, 180), von denen vier laengst behoben waren, und
// einen (OP-173) als offen gefuehrt, den die Lint-Ratsche seit Welle 4b-5
// nachweislich abdeckt.
//
// Die Ursache ist nicht Unaufmerksamkeit, sondern dass die Antwort aus einer
// SORTIERREGEL erschlossen werden musste, statt irgendwo zu stehen.
//
// WAS DIESES SKRIPT TUT
//
// Es leitet je Nummer den JUENGSTEN Eintrag ab — nach dem DATUM des
// Nachtrags, bei Gleichstand nach der Position (weiter oben = juenger) — und
// schreibt daraus `docs/OFFENE-PUNKTE-INDEX.md`: eine Tabelle, eine Zeile je
// Nummer, mit Stand und Fundstelle. Danach ist die Frage nachschlagbar statt
// erschliessbar.
//
// Ohne Argument prueft es, dass der eingecheckte Index dem Register
// entspricht — dieselbe Mechanik wie bei der generierten API-Doku. Ein Index,
// den niemand nachzieht, ist schlimmer als keiner.
//
// Aufruf:
//   node scripts/op-index.mjs            Pruefung (Exit 1 bei Abweichung)
//   node scripts/op-index.mjs --write    Index neu schreiben

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { format as prettierFormat, resolveConfig } from "prettier";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const REGISTER = "docs/OFFENE-PUNKTE-REGISTER.md";
const INDEX = "docs/OFFENE-PUNKTE-INDEX.md";
const WRITE = process.argv.includes("--write");

const zeilen = readFileSync(resolve(ROOT, REGISTER), "utf8").split("\n");

/** Datum des Abschnitts, in dem eine Zeile steht. "" fuer die Haupttabelle. */
const abschnitt = [];
let datum = "";
let titel = "";
for (const z of zeilen) {
  const m = /^###\s+Nachtrag\s+(\d{4}-\d{2}-\d{2})\s*—?\s*(.*)$/.exec(z);
  if (m) {
    datum = m[1];
    titel = m[2].trim();
  }
  abschnitt.push({ datum, titel });
}

/** Alle Tabellenzeilen mit OP-Nummer. */
const eintraege = new Map(); // Nummer -> beste Zeile
for (let i = 0; i < zeilen.length; i++) {
  const m = /^\|\s*(OP-\d{3})\s*\|(.*)$/.exec(zeilen[i]);
  if (!m) continue;
  const felder = m[2].split("|").map((x) => x.trim());
  while (felder.length && felder[felder.length - 1] === "") felder.pop();
  const kandidat = {
    nr: m[1],
    zeile: i + 1,
    datum: abschnitt[i].datum,
    abschnitt: abschnitt[i].titel,
    titel: (felder[0] ?? "").replace(/\*\*/g, ""),
    stand: (felder[felder.length - 1] ?? "").replace(/\*\*/g, ""),
  };
  const bisher = eintraege.get(m[1]);
  // Juenger = spaeteres Datum; bei Gleichstand die weiter OBEN stehende Zeile
  // (Nachtraege werden oben eingefuegt). Die Haupttabelle (Datum "") verliert
  // gegen jeden Nachtrag.
  const besser =
    !bisher ||
    kandidat.datum > bisher.datum ||
    (kandidat.datum === bisher.datum && kandidat.zeile < bisher.zeile);
  if (besser) eintraege.set(m[1], kandidat);
}

/**
 * Grobe Einordnung des Standes. Der Rohtext bleibt daneben stehen.
 *
 * Nur der ANFANG der Zelle wird gelesen (120 Zeichen). Die Konvention des
 * Registers setzt das Urteil nach vorn und die Begruendung dahinter — und in
 * der Begruendung steht "offen" auch mal in einem anderen Sinn. Gemessen an
 * OP-175: „**behoben** — … das Pack steht aber vier Rollen offen." Ueber die
 * ganze Zelle gelesen wurde daraus faelschlich „teilweise".
 */
function einordnen(stand) {
  const s = stand.toLowerCase().slice(0, 120);
  if (!s) return "ohne Stand";
  if (/\boffen\b/.test(s) && /behoben|erledigt/.test(s)) return "teilweise";
  if (/\boffen\b/.test(s)) return "offen";
  if (/behoben|erledigt|geschlossen|bricht jetzt ab|verweigert jetzt/.test(s))
    return "behoben";
  if (/entscheidung|eigent[uü]mer|betreiber|anwaltlich|gesch[aä]fts/.test(s))
    return "Entscheidung";
  return "ohne Stand";
}

const alle = [...eintraege.values()].sort((a, b) => a.nr.localeCompare(b.nr));
const gruppen = {
  offen: [],
  teilweise: [],
  Entscheidung: [],
  behoben: [],
  "ohne Stand": [],
};
for (const e of alle) gruppen[einordnen(e.stand)].push(e);

function kürzen(t, n) {
  const eine = t.replace(/\s+/g, " ").trim();
  return eine.length > n ? eine.slice(0, n - 1) + "…" : eine;
}

const md = [];
md.push("# Offene Punkte — Index");
md.push("");
md.push(
  "**Erzeugt von `scripts/op-index.mjs`. Nicht von Hand ändern** — die eine",
);
md.push(
  "Zeile je Nummer wird aus `OFFENE-PUNKTE-REGISTER.md` abgeleitet: der Eintrag",
);
md.push(
  "mit dem **jüngsten Nachtragsdatum**, bei Gleichstand der weiter oben stehende.",
);
md.push("");
md.push(
  "Der Grund für diese Datei steht im Kopf des Skripts: die Frage „was ist noch",
);
md.push(
  "offen?" +
    '" war bisher nur über eine Sortierregel zu beantworten, und die Regel galt',
);
md.push(
  "nicht einmal durchgehend — ein Nachtrag vom 2026-09-03 steht über welchen vom",
);
md.push("2026-09-09. Zweimal an einem Tag kam so eine falsche Liste heraus.");
md.push("");
md.push(`Nummern: **${alle.length}**`);
md.push("");
const reihenfolge = [
  "offen",
  "teilweise",
  "Entscheidung",
  "ohne Stand",
  "behoben",
];
for (const g of reihenfolge) {
  const rows = gruppen[g];
  md.push(`## ${g} (${rows.length})`);
  md.push("");
  if (rows.length === 0) {
    md.push("_keine_");
    md.push("");
    continue;
  }
  md.push("| Nr | Titel | Stand laut Register | Nachtrag |");
  md.push("| --- | --- | --- | --- |");
  for (const e of rows) {
    md.push(
      `| ${e.nr} | ${kürzen(e.titel, 110)} | ${kürzen(e.stand, 90) || "—"} | ${e.datum || "Haupttabelle"} |`,
    );
  }
  md.push("");
}

// [Welle 8h] Der Index ist eingecheckt und faellt damit unter den
// Format-Schritt aus ci.yml. Derselbe Befund wie OP-220 und OP-232: ein
// Generator, der rohes Markdown schreibt, macht das Format-Tor rot, ohne dass
// irgendetwas darauf hinweist. Er formatiert deshalb selbst — und weil der
// Vergleich unten gegen denselben formatierten Text laeuft, koennen Datei und
// Pruefung nicht auseinanderlaufen.
const cfg = (await resolveConfig(resolve(ROOT, INDEX))) ?? {};
const text = await prettierFormat(md.join("\n") + "\n", {
  ...cfg,
  filepath: INDEX,
  parser: "markdown",
});
const pfad = resolve(ROOT, INDEX);

if (WRITE) {
  writeFileSync(pfad, text);
  console.log(`Index geschrieben: ${INDEX}`);
  for (const g of reihenfolge) console.log(`  ${g}: ${gruppen[g].length}`);
  process.exit(0);
}

if (!existsSync(pfad)) {
  console.error(
    `✗ ${INDEX} fehlt.\n  Erzeugen mit: node scripts/op-index.mjs --write`,
  );
  process.exit(1);
}

if (readFileSync(pfad, "utf8") !== text) {
  console.error(
    `✗ ${INDEX} weicht vom Register ab.\n` +
      "  Neu erzeugen und mitcommitten:\n" +
      "    node scripts/op-index.mjs --write\n" +
      "  Ein Index, den niemand nachzieht, ist schlimmer als keiner — er\n" +
      "  beantwortet die Frage falsch statt gar nicht.",
  );
  process.exit(1);
}

console.log(
  `✓ ${INDEX} stimmt mit dem Register überein (${alle.length} Nummern).`,
);
for (const g of reihenfolge) console.log(`  ${g}: ${gruppen[g].length}`);
