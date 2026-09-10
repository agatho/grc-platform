// [Welle 5b · OP-104] Die Doku darf nicht mehr behaupten, als der Code meldet.
//
// Schwesterdatei zu `no-fabricated-evidence.test.ts`. Jene Suite haelt fest,
// dass kein Job ein Ergebnis persistiert, das er nicht gemessen hat. Diese hier
// haelt die andere Haelfte desselben Versprechens: dass die drei
// Statusdokumente die Faehigkeiten, die sich im Code ehrlich als
// "nicht implementiert" melden, nicht als fertig fuehren.
//
// Warum das ein Test ist und kein Absatz in einer Datei: OP-104 entstand,
// weil WP9 die Pfade ehrlich gemacht hat und die Doku danach unveraendert
// blieb. Genau diese Luecke schliesst sich nicht durch eine einmalige
// Korrektur — sie oeffnet sich beim naechsten Mal wieder. Deshalb wird die
// Liste hier aus dem QUELLCODE abgeleitet und gegen die Doku geprueft, statt
// in beiden Dateien gepflegt zu werden.
//
// Der Test faellt in drei Richtungen:
//   (a) ein neuer Pfad meldet "nicht implementiert" und steht nicht im
//       Inventar von `docs/feature-catalog.md`;
//   (b) ein Pfad wird implementiert, bleibt aber im Inventar stehen;
//   (c) jemand setzt eine der betroffenen Sprint-Zeilen wieder auf ein
//       blankes Haekchen.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// ── (1) Inventar aus dem Quellcode ableiten ──────────────────────────

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(REPO, dir), { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "coverage") continue;
      walk(join(dir, e.name), acc);
    } else if (e.name.endsWith(".ts")) {
      acc.push(join(dir, e.name));
    }
  }
  return acc;
}

/**
 * Die drei Formen, in denen dieses Repo "ich habe nichts gemessen" sagt:
 *
 *  - `throw new NotImplementedEvidenceError(...)` — der Job bricht ab und
 *    schreibt nichts (`apps/worker/src/lib/job-runtime.ts`).
 *  - HTTP 501 mit `error: "Not implemented"` — die Route weigert sich.
 *  - Der Job markiert den Datensatz als `failed` und begruendet es mit
 *    "not implemented in this build".
 */
function discoverRefusals(): Array<{ file: string; kind: string }> {
  const out: Array<{ file: string; kind: string }> = [];
  for (const file of [
    ...walk("apps/worker/src"),
    ...walk("apps/web/src/app/api"),
  ]) {
    const src = readFileSync(join(REPO, file), "utf8");
    const kinds: string[] = [];
    if (/new NotImplementedEvidenceError\(/.test(src)) kinds.push("throw");
    if (/error:\s*"Not implemented"/.test(src) && /status:\s*501/.test(src))
      kinds.push("501");
    if (
      /not implemented in this[\s\S]{0,20}build/.test(src) &&
      /report\.fail|errorMessage|errorLog/.test(src)
    )
      kinds.push("failed");
    if (kinds.length > 0)
      out.push({ file: file.replace(/\\/g, "/"), kind: kinds.join("+") });
  }
  // Die Definition des Fehlertyps selbst ist kein Pfad, der etwas meldet.
  return out.filter((r) => r.file !== "apps/worker/src/lib/job-runtime.ts");
}

// ── (2) Die Dokumente ────────────────────────────────────────────────

const CATALOG = readFileSync(join(REPO, "docs/feature-catalog.md"), "utf8");
const CLAUDE_MD = readFileSync(join(REPO, "CLAUDE.md"), "utf8");
const STATUS = readFileSync(join(REPO, "docs/STATUS.md"), "utf8");

/**
 * Eine Markdown-Tabellenzeile, in der `key` als eigene Zelle steht.
 *
 * `CLAUDE.md` fuehrt den Sprint-Bereich in der ersten Spalte,
 * `docs/STATUS.md` in der zweiten — deshalb wird ueber alle Zellen gesucht
 * und nicht auf eine Position festgelegt.
 */
function tableRow(doc: string, key: string): string | undefined {
  for (const line of doc.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.includes(key)) return line;
  }
  return undefined;
}

describe("Doku gegen ehrliche Verweigerungen (OP-104)", () => {
  const refusals = discoverRefusals();

  it("findet die verweigernden Quelldateien ueberhaupt", () => {
    // Sicherung gegen einen stillen Fehlgriff in der Ableitung: waere das
    // Muster kaputt, wuerde die Suite mit einer leeren Liste gruen laufen
    // und genau nichts pruefen. Das war einer der acht Befunde dieses
    // Audits ueber Tore, die nicht ausloesen konnten.
    expect(refusals.length).toBeGreaterThanOrEqual(10);
  });

  it("jede verweigernde Datei steht im Inventar von docs/feature-catalog.md", () => {
    const missing = refusals
      .map((r) => r.file)
      .filter((f) => !CATALOG.includes(f));
    expect(
      missing,
      `Nicht im Inventar: ${missing.join(", ")} — der Code meldet "nicht ` +
        `implementiert", die Doku fuehrt den Pfad nicht.`,
    ).toEqual([]);
  });

  it("das Inventar nennt keine Datei, die nicht mehr verweigert", () => {
    // Zeilen der Inventartabelle: `| `apps/...` | ... |`
    const listed = [...CATALOG.matchAll(/^\|\s*`(apps\/[^`]+\.ts)`/gm)].map(
      (m) => m[1],
    );
    expect(listed.length, "Inventartabelle nicht gefunden").toBeGreaterThan(0);
    const known = new Set(refusals.map((r) => r.file));
    const stale = listed.filter((f) => !known.has(f as string));
    expect(
      stale,
      `Im Inventar, aber nicht mehr verweigernd: ${stale.join(", ")} — ` +
        `entweder wurde die Faehigkeit gebaut (dann gehoert die Zeile weg) ` +
        `oder die Verweigerung wurde entfernt, ohne sie zu ersetzen.`,
    ).toEqual([]);
  });

  it("die im Inventar genannte Pfadzahl stimmt mit dem Code ueberein", () => {
    // 4 HTTP-Endpunkte + 7 Cron-Jobs + 8 Modul-Hintergrundprozesse.
    const moduleCrons = readFileSync(
      join(REPO, "apps/worker/src/lib/module-aware-cron.ts"),
      "utf8",
    );
    const moduleProcesses = [...moduleCrons.matchAll(/:\s*notImplemented\(/g)]
      .length;
    const paths = refusals.length - 1 + moduleProcesses;

    const stated = CATALOG.match(/<!--\s*OP-104:refusal-paths=(\d+)\s*-->/);
    expect(
      stated,
      "docs/feature-catalog.md fuehrt keinen Marker `<!-- OP-104:refusal-paths=N -->`",
    ).not.toBeNull();
    expect(
      Number(stated?.[1]),
      `Der Code hat ${paths} verweigernde Pfade (${refusals.length - 1} Dateien ` +
        `plus ${moduleProcesses} Modulprozesse); die Doku nennt ${stated?.[1]}.`,
    ).toBe(paths);
  });

  // ── (3) Kein blankes Haekchen auf einer betroffenen Zeile ──────────

  const CLAIM_ROWS: Array<{
    doc: string;
    src: string;
    key: string;
    why: string;
  }> = [
    {
      doc: "CLAUDE.md",
      src: CLAUDE_MD,
      key: "16–19",
      why: "Bulk Import — import-job-processor.ts importiert nichts",
    },
    {
      doc: "CLAUDE.md",
      src: CLAUDE_MD,
      key: "34–37",
      why: "GRC Agents (MCP) — MCP kommt im Anwendungscode nicht vor",
    },
    {
      doc: "CLAUDE.md",
      src: CLAUDE_MD,
      key: "62–66",
      why: "Connector-Test, -Health und Identity-Sync antworten 501",
    },
    {
      doc: "CLAUDE.md",
      src: CLAUDE_MD,
      key: "67–71",
      why: "AI Evidence Review, Predictive Risk und Control Testing verweigern",
    },
    {
      doc: "CLAUDE.md",
      src: CLAUDE_MD,
      key: "82–86",
      why: "Simulation Engine und Marketplace-Scanner verweigern",
    },
    {
      doc: "docs/STATUS.md",
      src: STATUS,
      key: "10–37",
      why: "enthaelt Bulk-Import und die GRC-Agents",
    },
    {
      doc: "docs/STATUS.md",
      src: STATUS,
      key: "62–66",
      why: "Connectors",
    },
    {
      doc: "docs/STATUS.md",
      src: STATUS,
      key: "67–71",
      why: "AI Evidence Review, Predictive Risk, Control Testing",
    },
    {
      doc: "docs/STATUS.md",
      src: STATUS,
      key: "82–86",
      why: "Simulation Engine, Marketplace",
    },
    {
      doc: "docs/feature-catalog.md",
      src: CATALOG,
      key: "16–19",
      why: "Bulk-Import",
    },
    {
      doc: "docs/feature-catalog.md",
      src: CATALOG,
      key: "82–86",
      why: "Simulation Engine, Marketplace",
    },
  ];

  for (const row of CLAIM_ROWS) {
    it(`${row.doc}: Zeile "${row.key}" traegt kein blankes Haekchen (${row.why})`, () => {
      const line = tableRow(row.src, row.key);
      expect(
        line,
        `Zeile "${row.key}" in ${row.doc} nicht gefunden`,
      ).toBeDefined();
      expect(
        line,
        `${row.doc} fuehrt "${row.key}" als fertig, obwohl ${row.why}.`,
      ).toMatch(/⚠️/);
    });
  }
});
