#!/usr/bin/env node
// i18n-key-inventory.mjs
//
// [ARCTOS-FULL-2026-08-31 · Welle 8c]
//
// DER BEFUND, DER DIESES SKRIPT AUSGELOEST HAT
//
// Beim Einpflegen neuer Uebersetzungen wurden in Welle 8b 24 vorhandene
// `esgAdvanced.materiality.*`-Schluessel in BEIDEN Sprachen ueberschrieben.
// Kein Check hat das gesehen, und das ist kein Zufall:
//
//   * `audit-i18n-coverage.mjs` vergleicht DE gegen EN. Eine SYMMETRISCHE
//     Loeschung ist dort per Konstruktion unsichtbar — beide Seiten bleiben
//     deckungsgleich.
//   * `audit-i18n-usage.mjs --max-unused` zaehlt Schluessel OHNE statische
//     Aufrufstelle. Verschwindet ein unbenutzter Schluessel, SINKT diese
//     Zahl. Der Check wird dadurch gruener, nicht roter.
//
// Ein verschwundener Schluessel ist damit die einzige Aenderung am Katalog,
// die kein bestehender Check melden kann — und zugleich die einzige, die
// unmittelbar sichtbar wird: der Nutzer sieht den rohen Schluessel.
//
// WAS DIESES SKRIPT PRUEFT
//
// Es fuehrt eine eingecheckte Bestandsliste (`.i18n-keys-ratchet.json`) mit
// der Zahl der Schluessel je Namespace und Sprache. `--check` meldet jeden
// Namespace, dessen Zahl GESUNKEN ist. Wachsen darf sie frei — neue
// Uebersetzungen sind das Ziel, nicht das Problem.
//
// Eine Absenkung ist nicht verboten, sie ist begruendungspflichtig:
//   node scripts/i18n-key-inventory.mjs --update --reason "warum das jetzt so ist"
// Der Grund landet in `_history` und bleibt dort stehen.
//
// Usage:
//   node scripts/i18n-key-inventory.mjs            Bestand anzeigen
//   node scripts/i18n-key-inventory.mjs --check    Check (Exit 1 bei Verlust)
//   node scripts/i18n-key-inventory.mjs --update --reason "…"

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);
const LANGS = ["de", "en"];
const MSG_DIR = join(ROOT, "apps/web/messages");
const BASELINE = join(ROOT, ".i18n-keys-ratchet.json");

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const UPDATE = argv.includes("--update");
const reasonIdx = argv.indexOf("--reason");
const REASON = reasonIdx !== -1 ? (argv[reasonIdx + 1] ?? "").trim() : "";

/** Blattschluessel eines Nachrichtenbaums, in Punktschreibweise. */
function leaves(obj, prefix = "", acc = []) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) leaves(v, full, acc);
    else acc.push(full);
  }
  return acc;
}

function messen() {
  /** @type {Record<string, Record<string, number>>} */
  const bestand = {};
  for (const lang of LANGS) {
    const dir = join(MSG_DIR, lang);
    if (!existsSync(dir)) continue;
    for (const datei of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const ns = datei.replace(/\.json$/, "");
      let baum;
      try {
        baum = JSON.parse(readFileSync(join(dir, datei), "utf8"));
      } catch (e) {
        console.error(
          `✗ ${lang}/${datei} ist kein gueltiges JSON: ${e.message}`,
        );
        process.exit(1);
      }
      (bestand[ns] ??= {})[lang] = leaves(baum).length;
    }
  }
  return bestand;
}

function ladeBaseline() {
  if (!existsSync(BASELINE)) return null;
  return JSON.parse(readFileSync(BASELINE, "utf8"));
}

const bestand = messen();
const gesamt = Object.values(bestand).reduce(
  (s, je) => s + (je.de ?? 0) + (je.en ?? 0),
  0,
);
const nsZahl = Object.keys(bestand).length;

if (UPDATE) {
  const alt = ladeBaseline();
  const verluste = [];
  if (alt) {
    for (const [ns, je] of Object.entries(alt.namespaces ?? {})) {
      for (const lang of LANGS) {
        const vorher = je[lang] ?? 0;
        const jetzt = bestand[ns]?.[lang] ?? 0;
        if (jetzt < vorher)
          verluste.push(`${ns}/${lang}: ${vorher} → ${jetzt}`);
      }
    }
  }
  if (verluste.length > 0 && !REASON) {
    console.error(
      `✗ ${verluste.length} Namespace(s) verlieren Schluessel:\n` +
        verluste.map((v) => `    ${v}`).join("\n") +
        "\n\n  Eine Absenkung braucht eine Begruendung in der Datei:\n" +
        '    node scripts/i18n-key-inventory.mjs --update --reason "warum"\n' +
        "  Der uebliche Weg ist nicht die Absenkung, sondern der Befund:\n" +
        "  ein verschwundener Schluessel wird dem Nutzer als roher Schluessel\n" +
        "  angezeigt.",
    );
    process.exit(1);
  }
  const history = alt?._history ?? [];
  if (verluste.length > 0) {
    history.push({
      date: new Date().toISOString().slice(0, 10),
      reason: REASON,
      losses: verluste,
    });
  }
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        _comment:
          "Bestandsliste der i18n-Schluessel je Namespace und Sprache. Von " +
          "scripts/i18n-key-inventory.mjs geprueft. Wachsen darf frei; jede " +
          "Absenkung verlangt --reason und wird in _history festgehalten. " +
          "Grund: eine symmetrische Loeschung in DE UND EN ist fuer " +
          "audit-i18n-coverage.mjs unsichtbar und senkt --max-unused sogar.",
        _updatedAt: new Date().toISOString().slice(0, 10),
        _history: history,
        namespaces: bestand,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Bestandsliste geschrieben: ${BASELINE}\n` +
      `  ${nsZahl} Namespaces, ${gesamt} Schluessel (DE + EN).`,
  );
  process.exit(0);
}

const alt = ladeBaseline();

if (!alt) {
  console.error(
    `✗ Keine Bestandsliste unter ${BASELINE}.\n` +
      "  Anlegen mit: node scripts/i18n-key-inventory.mjs --update\n" +
      "  Ein Check ohne Eingabe ist entweder dauerhaft rot oder dauerhaft\n" +
      "  gruen. Beides ist schlimmer als kein Check.",
  );
  process.exit(1);
}

const verluste = [];
const verschwunden = [];
for (const [ns, je] of Object.entries(alt.namespaces ?? {})) {
  if (!bestand[ns]) {
    verschwunden.push(ns);
    continue;
  }
  for (const lang of LANGS) {
    const vorher = je[lang] ?? 0;
    const jetzt = bestand[ns][lang] ?? 0;
    if (jetzt < vorher)
      verluste.push(
        `${ns}/${lang}: ${jetzt} < Bestand ${vorher} (−${vorher - jetzt})`,
      );
  }
}

console.log(
  `i18n-Bestand: ${nsZahl} Namespaces, ${gesamt} Schluessel (DE + EN).`,
);

if (verschwunden.length > 0 || verluste.length > 0) {
  console.error(
    `\n✗ Schluesselverlust im Katalog (${verschwunden.length + verluste.length}):`,
  );
  for (const ns of verschwunden)
    console.error(`  ✗ Namespace ${ns} existiert nicht mehr.`);
  for (const v of verluste) console.error(`  ✗ ${v}`);
  console.error(
    "\n  Ein verschwundener Schluessel wird dem Nutzer als ROHER SCHLUESSEL\n" +
      "  angezeigt. Der DE/EN-Vergleich ist bei symmetrischer Loeschung blind\n" +
      "  (nachgemessen: Exit 0), und --max-unused faellt nur zufaellig an —\n" +
      "  war der Schluessel unbenutzt, SINKT die Zahl und der Check wird\n" +
      "  gruener. Genau so ist der Verlust in Welle 8b unbemerkt geblieben.\n" +
      "  Wiederherstellen — oder, wenn die Loeschung gewollt ist:\n" +
      '    node scripts/i18n-key-inventory.mjs --update --reason "warum"',
  );
  if (CHECK) process.exit(1);
} else {
  console.log("\n✓ Kein Schluesselverlust gegenueber der Bestandsliste.");
}
