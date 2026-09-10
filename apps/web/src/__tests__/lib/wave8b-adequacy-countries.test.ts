/**
 * [ARCTOS-FULL-2026-08-31 / Welle 8b · OP-201]
 *
 * Welle 6a hat die zweite Kopie von `ADEQUACY_COUNTRIES` gefunden und
 * entfernt (verdeckt, nie erreicht, und mit dem Nicht-ISO-Code "UK" auch noch
 * falsch). Der Kommentar an der Fundstelle
 * (`packages/shared/src/types/eam-advanced.ts`) hat dabei eine DRITTE Kopie
 * benannt und ausdruecklich nicht angefasst: inline in
 * `apps/web/src/app/api/v1/tprm/sub-processors/route.ts`.
 *
 * Nachgemessen am 2026-09-09 gegen `66de0a95`:
 *
 *   shared (15): AD AR CA CH FO GB GG IL IM JE JP KR NZ US UY
 *   route  (14): AD AR CA CH FO GB GG IL IM JE JP KR NZ    UY
 *   Unterschied: US
 *
 * Die RICHTIGE Liste ist die in `packages/shared`. Sie ist deckungsgleich mit
 * den Angemessenheitsbeschluessen der Kommission nach Art. 45 DSGVO, die in
 * Kraft sind — Andorra, Argentinien, Kanada (kommerzieller Bereich),
 * Faeroeer, Guernsey, Isle of Man, Israel, Japan, Jersey, Neuseeland,
 * Republik Korea, Schweiz, Vereinigtes Koenigreich, Uruguay und die USA
 * (EU-US Data Privacy Framework, 10.07.2023). Die Liste in der Route ist
 * dieselbe MINUS der USA, also der Stand vor Juli 2023.
 *
 * Die Folge ist kein Schoenheitsfehler: `route.ts` schreibt aus dieser Liste
 * `isEuAdequate` und `requiresTia` in `vendor_sub_processor`. Ein
 * Unterauftragsverarbeiter mit `hostingCountry = "US"` bekommt dort
 * `isAdequateCountry: false` und `requiresTia: true` — waehrend
 * `assessTransferRisk("US")` aus demselben Repository „hasAdequacy: true"
 * antwortet. DERSELBE Sachverhalt, ZWEI Antworten, je nachdem welchen Weg
 * der Nutzer nimmt.
 *
 * BEHOBEN am 2026-09-09 (Welle 8c). Die Route traegt keine eigenen Listen
 * mehr; sie importiert `ADEQUACY_COUNTRIES` und `EU_EEA_COUNTRIES` aus
 * `@grc/shared` — derselben Stelle, aus der sie ihr Schema ohnehin schon
 * bezieht. `EU_EEA_COUNTRIES` ist dafuer neben die Angemessenheitsliste nach
 * `dpms-tia.ts` gewandert: beide beantworten dieselbe Frage und muessen
 * zusammen gepflegt werden.
 *
 * Dieser Test hat vorher den UNBEHOBENEN Zustand festgeschrieben (zwei
 * Deklarationen, Unterschied genau {US}). Er sichert jetzt das Gegenteil:
 * genau EINE Deklaration im ganzen Repository, vollstaendig nach Art. 45
 * DSGVO. Damit faellt er, sobald jemand wieder eine Kopie anlegt — und
 * gemessen faellt er auch gegen `66de0a95`, wo es zwei waren.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const REPO = path.join(__dirname, "../../../../..");

/** Die Angemessenheitsbeschluesse nach Art. 45 DSGVO, die in Kraft sind. */
const ADEQUACY_ART_45 = [
  "AD", // Andorra
  "AR", // Argentinien
  "CA", // Kanada (kommerzieller Bereich)
  "CH", // Schweiz
  "FO", // Faeroeer
  "GB", // Vereinigtes Koenigreich
  "GG", // Guernsey
  "IL", // Israel
  "IM", // Isle of Man
  "JE", // Jersey
  "JP", // Japan (privater Sektor)
  "KR", // Republik Korea
  "NZ", // Neuseeland
  "US", // USA (EU-US Data Privacy Framework, 10.07.2023)
  "UY", // Uruguay
];

const KANON = "packages/shared/src/state-machines/dpms-tia.ts";
const TPRM_ROUTE = "apps/web/src/app/api/v1/tprm/sub-processors/route.ts";

const SUCHRAEUME = [
  "apps/web/src",
  "apps/worker/src",
  "packages/shared/src",
  "packages/db/src",
  "packages/auth/src",
  "packages/ai/src",
];

function quelldateien(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const eintrag of readdirSync(dir)) {
    const p = path.join(dir, eintrag);
    if (statSync(p).isDirectory()) quelldateien(p, acc);
    else if (/\.tsx?$/.test(p)) acc.push(p);
  }
  return acc;
}

function alleFundstellen(): string[] {
  const treffer: string[] = [];
  for (const raum of SUCHRAEUME) {
    for (const f of quelldateien(path.join(REPO, raum))) {
      if (/\bADEQUACY_COUNTRIES\s*=/.test(readFileSync(f, "utf8")))
        treffer.push(path.relative(REPO, f).split(path.sep).join("/"));
    }
  }
  return treffer.sort();
}

function codesAus(rel: string, name = "ADEQUACY_COUNTRIES"): string[] {
  const src = readFileSync(path.join(REPO, rel), "utf8");
  const m = src.match(
    new RegExp(`${name}\\s*=\\s*(?:new Set\\()?\\[([\\s\\S]*?)\\]`),
  );
  if (!m) throw new Error(`keine Liste ${name} in ${rel}`);
  return [...m[1].matchAll(/"([A-Z]{2})"/g)].map((x) => x[1]).sort();
}

describe("Welle 8b — OP-201: die Angemessenheitsliste", () => {
  it("die kanonische Liste ist die DSGVO-Liste, vollstaendig", () => {
    expect(codesAus(KANON)).toEqual([...ADEQUACY_ART_45].sort());
  });

  it("wird im ganzen Repository genau EINMAL deklariert", () => {
    // Gegen 66de0a95 waren es zwei. Legt jemand wieder eine Kopie an — inline
    // in einer Route, in einem Paket, egal wo —, faellt dieser Fall. Genau so
    // ist die abweichende dritte Fassung ueberhaupt entstanden.
    expect(alleFundstellen()).toEqual([KANON]);
  });

  it("die TPRM-Route fuehrt keine eigenen Listen mehr, sondern importiert sie", () => {
    const src = readFileSync(path.join(REPO, TPRM_ROUTE), "utf8");
    expect(src).not.toMatch(/ADEQUACY_COUNTRIES\s*=/);
    expect(src).not.toMatch(/EU_EEA_COUNTRIES\s*=/);
    expect(src).toMatch(
      /import\s*\{[\s\S]*ADEQUACY_COUNTRIES[\s\S]*\}\s*from\s*"@grc\/shared"/,
    );
    expect(src).toMatch(
      /import\s*\{[\s\S]*EU_EEA_COUNTRIES[\s\S]*\}\s*from\s*"@grc\/shared"/,
    );
  });

  it("die USA stehen in der Liste, die die Route jetzt benutzt", () => {
    // Der eigentliche Befund, und die Zusicherung, die ihn nicht
    // wiederkommen laesst: die abweichende Fassung war die Liste vor dem
    // EU-US Data Privacy Framework vom 10.07.2023.
    expect(codesAus(KANON)).toContain("US");
  });

  it("alle Codes sind ISO 3166-1 alpha-2", () => {
    // Welle 6a hat die verdeckte Kopie an "UK" erkannt — kein ISO-Code, und
    // deshalb von keinem Laendercode aus der Datenbank je getroffen.
    for (const rel of alleFundstellen())
      for (const c of codesAus(rel)) expect(c).toMatch(/^[A-Z]{2}$/);
    expect(codesAus(KANON)).not.toContain("UK");
  });
});
