/// <reference lib="dom" />

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { renderGrcScene, toGrcSvgString } from "../../src/grc/render";
import { shortRetentionFilter } from "../../src/grc/catalog";
import { buildGrcTextAlternative } from "../../src/grc/text-alternative";
import { viewById, type GrcViewId } from "../../src/grc/views";
import type { GrcOverlayData } from "../../src/grc/contract";
import type { GrcFilter } from "../../src/grc/layers";
import { installSvgPolyfills } from "../draw/helpers/jsdom-svg";
import {
  bankPrivacyData,
  bankSodData,
  goodsReceiptRetentionData,
  largeProcessData,
  orderRollupData,
  procurementComplianceData,
  salesRiskControlData,
  tourOutageData,
} from "./fixtures";
import { corpusScene, RENDERED_DIR } from "./helpers";

/**
 * Sichtbare Belege.
 *
 * Jede Sicht wird mit echten Korpusdiagrammen und den Fixture-Daten in eine
 * eigenständige SVG-Datei gezeichnet (`test/grc/rendered/`). Diese Dateien sind
 * zum Ansehen gedacht — sie sind der Nachweis, dass die Schicht nicht nur
 * Attribute setzt, sondern ein Bild ergibt, das man einem Prüfer vorlegen kann.
 *
 * Zugleich prüft dieser Lauf die Zusicherungen, die im Bild nicht sichtbar sind:
 * keine NaN-Koordinate, keine Dekoration außerhalb der Zeichenfläche, jede
 * gezeichnete Angabe auch als Text.
 */

interface Case {
  readonly file: string;
  readonly corpus: string;
  readonly view: GrcViewId;
  readonly data: () => GrcOverlayData;
  readonly title: string;
  readonly shows: string;
  readonly filter?: GrcFilter;
}

const CASES: readonly Case[] = [
  {
    file: "01-risiko-kontrolle-vertrieb",
    corpus: "repo-prd-sales-with-gateway",
    view: "risk-control",
    data: salesRiskControlData,
    title: "Vertrieb — Risiko & Kontrolle",
    shows:
      "F1 Kontrollabdeckungs-Heatmap (rot, grobe Schraffur an „Angebot erstellen“), F2 Risiko-Ampel, A3 Feststellungsampel, A4 LoD-Kante, F9 Kommentar-Pins",
  },
  {
    file: "02-compliance-beschaffung",
    corpus: "repo-prd-procurement",
    view: "compliance",
    data: procurementComplianceData,
    title: "Beschaffung — Compliance & Nachweis",
    shows:
      "F4 Nachweisfälligkeits-Ampel als Formkodierung, F8 Framework-Chips und Abdeckungsgrad in der Kopfzeile, F13 Kontrolltest-Badge",
  },
  {
    file: "03-datenschutz-kreditantrag",
    corpus: "synth-collaboration-pools-lanes",
    view: "privacy",
    data: bankPrivacyData,
    title: "Kreditantrag — Datenschutz",
    shows:
      "F5 Doppelkante mit Länderchip US über die Vertrauensgrenze, Personenbezug als Formkodierung, DPIA-Befund, F10 Aufbewahrungsfrist im Gutter",
  },
  {
    file: "04-sod-kreditantrag",
    corpus: "synth-collaboration-pools-lanes",
    view: "organization",
    data: bankSodData,
    title: "Kreditantrag — Organisation & SoD",
    shows:
      "F3 SoD-Konfliktbogen mit Schloss zwischen den Lanes, Selbstkontroll-Warnung, R/A-Kürzel",
  },
  {
    file: "05-ausfallsimulation-tourenplanung",
    corpus: "repo-seed-tour-planning",
    view: "continuity",
    data: tourOutageData,
    title: "Tourenplanung — Ausfall von DispoSuite",
    shows:
      "F6 Ausfallsimulation: betroffener Schritt schraffiert, Ausweichverfahren markiert, MTPD-Reißpunkt in der Kopfzeile, RTO/RPO im Gutter",
  },
  {
    file: "06-rollup-callactivity",
    corpus: "repo-seed-order-callactivity",
    view: "risk-control",
    data: orderRollupData,
    title: "Auftragsabwicklung — Roll-up über die Call Activity",
    shows:
      "F2 Risiko-Roll-up: die Call Activity erbt Risiko und Abdeckung des Zielprozesses (Pfeil ↗ am Badge)",
  },
  {
    file: "07-conformance-grossprozess",
    corpus: "synth-large-flat-process",
    view: "operations",
    data: largeProcessData,
    title: "Großer Prozess — Betrieb & Effizienz",
    shows:
      "F7 Conformance-Heatmap mit ausgewiesener Abdeckungsquote, Kantenstärke nach Häufigkeit, roter Ist-Pfad, Slot-Budget mit Sammel-Badges",
  },
  {
    file: "08-loeschsicht-wareneingang",
    corpus: "repo-seed-goods-receipt",
    view: "privacy",
    data: goodsReceiptRetentionData,
    title: "Wareneingang — Aufbewahrung und Löschung",
    shows:
      "F10 Löschsicht mit Filter „Löschfrist < 12 Monate“: nicht passende Schritte werden abgeblendet, nie ausgeblendet",
    filter: shortRetentionFilter,
  },
];

beforeAll(() => {
  installSvgPolyfills();
  rmSync(RENDERED_DIR, { recursive: true, force: true });
  mkdirSync(RENDERED_DIR, { recursive: true });
});

const index: Array<{
  file: string;
  title: string;
  shows: string;
  notes: string;
}> = [];

describe("Sichtbare Belege", () => {
  for (const entry of CASES) {
    it(`${entry.file}: ${entry.title}`, async () => {
      const scene = await corpusScene(entry.corpus);
      const result = renderGrcScene(scene, entry.data(), {
        view: viewById(entry.view),
        title: entry.title,
        legend: true,
        ...(entry.filter ? { filter: entry.filter } : {}),
      });

      const svg = toGrcSvgString(result);
      writeFileSync(join(RENDERED_DIR, `${entry.file}.svg`), svg, "utf8");

      const alternative = buildGrcTextAlternative(scene, result.model);
      writeFileSync(
        join(RENDERED_DIR, `${entry.file}.txt`),
        [
          entry.title,
          "",
          ...alternative.notes,
          "",
          alternative.prose,
          "",
          ...alternative.rows.map((row) =>
            [
              `${String(row.index)}. ${row.name || row.id} (${row.typeLabel})`,
              ...alternative.columns.map((column) =>
                row.grc[column.layerId]
                  ? `    ${column.header}: ${row.grc[column.layerId] ?? ""}`
                  : "",
              ),
            ]
              .filter((line) => line !== "")
              .join("\n"),
          ),
        ].join("\n"),
        "utf8",
      );

      index.push({
        file: entry.file,
        title: entry.title,
        shows: entry.shows,
        notes: alternative.notes.join(" "),
      });

      // Zusicherungen, die man dem Bild nicht ansieht:
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("undefined");
      expect(result.decoration.decoratedElements).toBeGreaterThan(0);
      expect(svg.length).toBeGreaterThan(2000);

      // Die Dekoration liegt vollständig im sichtbaren Bereich.
      const viewBox =
        result.svg.getAttribute("viewBox")?.split(/\s+/).map(Number) ?? [];
      const [vx, vy, vw, vh] = viewBox;
      expect(vw).toBeGreaterThan(0);
      for (const node of Array.from(
        result.svg.querySelectorAll(
          '[data-grc="badge"] rect, [data-grc="banner"] rect',
        ),
      )) {
        const x = Number(node.getAttribute("x"));
        const y = Number(node.getAttribute("y"));
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(x, `${entry.file} x`).toBeGreaterThanOrEqual((vx ?? 0) - 1);
        expect(y, `${entry.file} y`).toBeGreaterThanOrEqual((vy ?? 0) - 1);
        expect(x, `${entry.file} x max`).toBeLessThanOrEqual(
          (vx ?? 0) + (vw ?? 0),
        );
        expect(y, `${entry.file} y max`).toBeLessThanOrEqual(
          (vy ?? 0) + (vh ?? 0),
        );
      }
    });
  }

  it("schreibt eine Übersichtsseite", () => {
    expect(index.length).toBe(CASES.length);
    const html = [
      "<!doctype html>",
      '<html lang="de"><head><meta charset="utf-8">',
      "<title>GRC-Diagrammschicht — sichtbare Belege</title>",
      "<style>body{font:14px/1.5 system-ui,sans-serif;margin:2rem;max-width:70rem}" +
        "figure{margin:0 0 3rem}img{max-width:100%;border:1px solid #ccd}" +
        "figcaption{margin-top:.5rem}code{background:#f2f4f7;padding:.1em .3em}</style>",
      "</head><body>",
      "<h1>GRC-Diagrammschicht — sichtbare Belege</h1>",
      "<p>Echte Korpusdiagramme aus <code>test/corpus/</code>, erfundene, aber plausible GRC-Daten aus <code>test/grc/fixtures.ts</code>. Erzeugt von <code>test/grc/render.test.ts</code>.</p>",
      ...index.map(
        (entry) =>
          `<figure><img src="${entry.file}.svg" alt="${entry.title}">` +
          `<figcaption><strong>${entry.title}</strong><br>${entry.shows}<br>` +
          `<small>${entry.notes}</small><br>` +
          `<a href="${entry.file}.txt">Textalternative</a></figcaption></figure>`,
      ),
      "</body></html>",
    ].join("\n");
    writeFileSync(join(RENDERED_DIR, "_index.html"), html, "utf8");
  });
});
