// client-pagination-contract.test.ts — der Wächter zu OP-050.
//
// [ARCTOS-FULL-2026-08-31 · OP-050]
//
// Warum ein Test über den Quelltext und keine Lint-Regel und keine
// Laufzeitprüfung:
//
//   * Eine **Lint-Regel** sieht `limit=200` in einer Zeichenkette, aber nicht,
//     wohin die Zeichenkette zeigt. Sie müsste jede URL mit einer grossen Zahl
//     verbieten — auch die drei, die heute korrekt sind, weil ihre Route den
//     Vertrag gar nicht spricht. Eine Regel, die man in drei Dateien
//     abschalten muss, wird in der vierten auch abgeschaltet.
//   * Eine **Laufzeitprüfung im Fetch-Helfer** fängt nur, wer den Helfer
//     benutzt. Der Defekt ist aber gerade, dass 30 Stellen `fetch()` direkt
//     aufrufen. Der Helfer (`lib/api-client.ts`) ist die Reparatur, nicht der
//     Wächter.
//   * Dieser Test kann beides, was zählt: er liest die Aufrufstelle **und**
//     löst die Zielroute auf. Er verbietet nicht „grosse Zahl", sondern die
//     eigentliche Paarung — *Client fragt mehr als `MAX_PAGE_SIZE` von einer
//     Route, die `paginate()` benutzt*. Genau die endet in 422 und genau die
//     ist der Befund.
//
// Der zweite, wichtigere Teil: die Übergabeliste `NOCH_OHNE_VERTRAG`. Drei
// Aufrufstellen fragen heute mehr als 100 von Routen, die `paginate()` NICHT
// benutzen, sondern selbst auf 500 klemmen. Sie laufen — bis jemand die Route
// auf den Vertrag umstellt. Dann wird dieser Test rot, und zwar an der
// Aufrufstelle, nicht erst im Browser eines Mandanten. Ein Eintrag, der nicht
// mehr zutrifft, lässt den Test ebenfalls fehlschlagen: eine Ausnahmeliste,
// die nicht schrumpfen muss, ist keine Ausnahmeliste.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { MAX_PAGE_SIZE } from "@/lib/pagination-contract";

const WEB_SRC = join(__dirname, "../..");
const API_ROOT = join(WEB_SRC, "app/api/v1");

/**
 * Aufrufstellen, die mehr als `MAX_PAGE_SIZE` anfordern, deren Zielroute
 * `paginate()` aber nicht benutzt (sie klemmt selbst auf 500 und kennt kein
 * `page`). Heute kein 422 — aber auch kein Vertrag.
 *
 * Die Umstellung der Routen liegt bei Strang 1a; siehe
 * `docs/UMSETZUNG-WELLE-1B.md`, Abschnitt „Was 1a übernehmen muss".
 */
const NOCH_OHNE_VERTRAG: ReadonlyArray<string> = [
  "app/(dashboard)/eam/applications/page.tsx",
  "app/(dashboard)/eam/data-flows/page.tsx",
  "app/(dashboard)/programmes/[id]/events/page.tsx",
  // Dateihoheit Strang 1c (apps/web/src/components/**) — dieselbe Lage:
  // `GET /api/v1/processes/[id]/audit-trail` und
  // `GET /api/v1/compliance/frameworks/[code]` klemmen selbst.
  "components/process/process-audit-trail-tab.tsx",
  "components/documents/ai-draft-policy-dialog.tsx",
];

/**
 * Aufrufstellen aus fremder Dateihoheit, die den Vertrag verletzen und in
 * dieser Welle nicht angefasst werden durften. Die Liste MUSS leer werden.
 *
 * **Sie ist leer.** Hier standen `process-controls-tab.tsx` (Auswahldialog
 * für Kontrollen) und `process-review-config.tsx` (Prüferauswahl); beide
 * fragten `limit=200` von einer `paginate()`-Route, bekamen 422 und zeigten
 * das Ergebnis als leere Liste — der eine als „diese Organisation hat keine
 * Kontrollen", der andere als „es gibt niemanden, den man als Prüfer
 * eintragen könnte". Beide laufen jetzt über `fetchAllPages` und sagen im
 * Fehlerfall, dass etwas fehlgeschlagen ist, statt eine Aussage über den
 * Datenbestand zu erfinden.
 *
 * Ein neuer Eintrag hier braucht denselben Nachweis wie ein Eintrag in
 * `NOCH_OHNE_VERTRAG`: welche Route, warum jetzt nicht, und wer sie nachzieht.
 */
const UEBERGABE_1C: ReadonlyArray<string> = [];

interface Fundstelle {
  datei: string;
  zeile: number;
  limit: number;
  url: string | null;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

/**
 * Löst `/api/v1/foo/${bar}/baz` auf die zugehörige `route.ts` auf. Dynamische
 * Segmente werden auf das einzige `[…]`-Verzeichnis der Ebene abgebildet.
 */
function routeFor(url: string): string | null {
  const pfad = url.split("?")[0];
  if (!pfad.startsWith("/api/v1/")) return null;
  let dir = API_ROOT;
  for (const seg of pfad.slice("/api/v1/".length).split("/").filter(Boolean)) {
    const literal = join(dir, seg);
    if (
      !/\$\{/.test(seg) &&
      existsSync(literal) &&
      statSync(literal).isDirectory()
    ) {
      dir = literal;
      continue;
    }
    const dynamisch = readdirSync(dir).find(
      (e) => /^\[.*\]$/.test(e) && statSync(join(dir, e)).isDirectory(),
    );
    if (!dynamisch) return null;
    dir = join(dir, dynamisch);
  }
  const rf = join(dir, "route.ts");
  return existsSync(rf) ? rf : null;
}

/**
 * Sammelt alle Stellen, an denen Client-Code eine Seitengrösse über
 * `MAX_PAGE_SIZE` an die eigene API schickt — als `?limit=NNN` in einer URL
 * oder als `limit: "NNN"` in einem `URLSearchParams`-Objekt.
 */
function fundstellen(): Fundstelle[] {
  const dateien = walk(WEB_SRC).filter(
    (f) =>
      !f.includes(`${join("app", "api")}`) &&
      !f.includes("__tests__") &&
      !f.endsWith("api-client.ts") &&
      !f.endsWith("pagination-contract.ts"),
  );
  const treffer: Fundstelle[] = [];

  for (const datei of dateien) {
    const zeilen = readFileSync(datei, "utf8").split("\n");
    zeilen.forEach((zeile, i) => {
      // Kommentare zählen nicht — sie beschreiben den Defekt oft.
      if (/^\s*(\/\/|\*|\/\*)/.test(zeile)) return;
      const werte = [
        ...zeile.matchAll(/limit=(\d+)/g),
        ...zeile.matchAll(/limit:\s*"(\d+)"/g),
      ];
      for (const m of werte) {
        const n = Number(m[1]);
        if (n <= MAX_PAGE_SIZE) continue;
        // URL derselben Zeile oder — bei URLSearchParams — der Datei.
        const inline = zeile.match(/["'`](\/api\/v1\/[^"'`?\s]*)/);
        const inDatei = zeilen
          .slice(Math.max(0, i - 15), i + 15)
          .join("\n")
          .match(/["'`](\/api\/v1\/[^"'`?\s]*)/);
        treffer.push({
          datei: relative(WEB_SRC, datei),
          zeile: i + 1,
          limit: n,
          url: (inline ?? inDatei)?.[1] ?? null,
        });
      }
    });
  }
  return treffer;
}

function benutztPaginate(url: string | null): boolean {
  if (!url) return false;
  const rf = routeFor(url);
  if (!rf) return false;
  return /\bpaginate\s*\(/.test(readFileSync(rf, "utf8"));
}

describe("OP-050 — kein Client-Aufruf über MAX_PAGE_SIZE gegen eine paginate()-Route", () => {
  const alle = fundstellen();

  it("findet keine Aufrufstelle, die in 422 laufen würde", () => {
    const verletzungen = alle
      .filter((f) => benutztPaginate(f.url))
      // Die Übergabe an 1c ist namentlich, datiert und im nächsten Test
      // gegengeprüft — sie darf nicht wachsen und muss verschwinden.
      .filter((f) => !UEBERGABE_1C.includes(f.datei))
      .map(
        (f) =>
          `${f.datei}:${f.zeile} — limit=${f.limit} gegen ${f.url} ` +
          `(Route benutzt paginate() ⇒ 422 ⇒ leere Liste)`,
      );
    expect(verletzungen).toEqual([]);
  });

  it("hält die Übergabeliste an Strang 1c aktuell", () => {
    const offen = alle
      .filter((f) => UEBERGABE_1C.includes(f.datei))
      .map((f) => f.datei);
    // Jede gelistete Datei muss noch verletzen; sonst ist der Eintrag tot
    // und gehört entfernt (samt dieser Zeile im Protokoll).
    for (const datei of UEBERGABE_1C) {
      expect(
        offen,
        `${datei} ist repariert — Eintrag aus UEBERGABE_1C entfernen`,
      ).toContain(datei);
    }
  });

  it("hält NOCH_OHNE_VERTRAG aktuell: keine dieser Routen benutzt paginate()", () => {
    for (const datei of NOCH_OHNE_VERTRAG) {
      const treffer = alle.filter((f) => f.datei === datei);
      expect(
        treffer.length,
        `${datei} fragt nicht mehr über ${MAX_PAGE_SIZE} — Eintrag aus ` +
          `NOCH_OHNE_VERTRAG entfernen`,
      ).toBeGreaterThan(0);
      for (const f of treffer) {
        expect(
          benutztPaginate(f.url),
          `${datei}:${f.zeile} — die Route ${f.url} benutzt jetzt paginate(). ` +
            `Die Aufrufstelle muss auf ${MAX_PAGE_SIZE} + Blättern umgestellt ` +
            `werden, sonst antwortet sie ab sofort mit 422.`,
        ).toBe(false);
      }
    }
  });

  it("kennt keine Aufrufstelle ausserhalb der beiden Listen", () => {
    const bekannt = new Set([...NOCH_OHNE_VERTRAG, ...UEBERGABE_1C]);
    const unbekannt = alle
      .filter((f) => !bekannt.has(f.datei))
      .map((f) => `${f.datei}:${f.zeile} (limit=${f.limit} → ${f.url})`);
    expect(unbekannt).toEqual([]);
  });
});
