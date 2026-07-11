// ReportDocument → PDF via pdfkit (the renderer that replaced the
// Sprint-30 Puppeteer path). pdfkit is a declared dependency of
// @grc/reporting since the 2026-07-11 dependency maintenance window.
//
// compress:false keeps content streams readable. pdfkit emits text as
// hex-encoded TJ arrays split at kerning points (e.g. "Titel" →
// [<546974656c> 0] TJ), so the assertions decode every <hex> string and
// concatenate — contiguous run text like "Quartalsbericht ISMS" then
// reappears verbatim.

import { describe, it, expect } from "vitest";
import { renderReportDocumentPdf } from "../src/renderers/pdfkit-renderer";
import type { ReportDocument } from "../src/report-document";

/** Decode all <hex> strings of an uncompressed PDF into one text blob. */
function extractText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  let out = "";
  for (const match of raw.matchAll(/<([0-9a-f]+)>/gi)) {
    const hex = match[1] ?? "";
    if (hex.length % 2 !== 0) continue;
    out += Buffer.from(hex, "hex").toString("latin1");
  }
  return out;
}

function makeModel(overrides: Partial<ReportDocument> = {}): ReportDocument {
  return {
    generatedAt: "2026-07-11T09:30:00.000Z",
    branding: {
      primaryColor: "#1e3a5f",
      footerText: "ARCTOS GRC Platform",
      confidentiality: "Vertraulich",
      logoUrl: null,
    },
    sections: [
      { kind: "heading", text: "Quartalsbericht ISMS" },
      { kind: "paragraph", text: "Zusammenfassung des Quartals." },
      { kind: "kpi", label: "Total Risks", value: 42, trend: "stable" },
      { kind: "kpi", label: "High Risks", value: 7, trend: "up" },
      {
        kind: "table",
        title: "Risiko-Register",
        headers: ["ID", "Titel"],
        rows: [
          ["RSK00000001", "Datenleck"],
          ["RSK00000002", 16],
        ],
      },
      {
        kind: "chart",
        title: "Risiken je Kategorie",
        chartType: "bar",
        labels: ["cyber", "operational"],
        datasets: [{ label: "Risks", data: [5, 3] }],
      },
    ],
    ...overrides,
  };
}

const countPages = (buf: Buffer): number =>
  (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

describe("renderReportDocumentPdf", () => {
  it("produces a valid PDF (magic bytes + EOF)", async () => {
    const buffer = await renderReportDocumentPdf(makeModel());
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.subarray(-32).toString("latin1")).toContain("%%EOF");
  });

  it("renders all section kinds into the page content (compress:false)", async () => {
    const buffer = await renderReportDocumentPdf(makeModel(), {
      compress: false,
    });
    const text = extractText(buffer);
    expect(text).toContain("Quartalsbericht ISMS"); // heading
    expect(text).toContain("Zusammenfassung des Quartals."); // paragraph
    expect(text).toContain("Total Risks"); // kpi label
    expect(text).toContain("Risiko-Register"); // table title
    expect(text).toContain("Datenleck"); // table cell
    expect(text).toContain("Risiken je Kategorie"); // chart title
    expect(text).toContain("operational"); // chart label
    expect(text).toContain("Page 1 of"); // footer chrome
    expect(text).toContain("VERTRAULICH"); // confidentiality (uppercased)
  });

  it("honours pageBreak sections", async () => {
    const single = await renderReportDocumentPdf(makeModel());
    const withBreak = await renderReportDocumentPdf(
      makeModel({
        sections: [
          { kind: "paragraph", text: "Seite eins" },
          { kind: "pageBreak" },
          { kind: "paragraph", text: "Seite zwei" },
        ],
      }),
    );
    expect(countPages(single)).toBe(1);
    expect(countPages(withBreak)).toBe(2);
  });

  it("paginates long tables and repeats the header row", async () => {
    const buffer = await renderReportDocumentPdf(
      makeModel({
        sections: [
          {
            kind: "table",
            headers: ["ID", "Titel"],
            rows: Array.from({ length: 120 }, (_, i) => [
              `RSK${String(i + 1).padStart(8, "0")}`,
              `Risiko ${i + 1}`,
            ]),
          },
        ],
      }),
      { compress: false },
    );
    expect(countPages(buffer)).toBeGreaterThan(1);
    // Header cell "Titel" re-drawn on every page.
    const headerOccurrences = extractText(buffer).match(/Titel/g) ?? [];
    expect(headerOccurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("degrades non-bar charts to a value table instead of importing a chart lib", async () => {
    const buffer = await renderReportDocumentPdf(
      makeModel({
        sections: [
          {
            kind: "chart",
            title: "Trend",
            chartType: "line",
            labels: ["2026-01", "2026-02"],
            datasets: [{ label: "New Risks", data: [4, 9] }],
          },
        ],
      }),
      { compress: false },
    );
    const text = extractText(buffer);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(text).toContain("New Risks"); // dataset label as table header
    expect(text).toContain("2026-01"); // chart label as table row
  });

  it("renders empty models without throwing", async () => {
    const buffer = await renderReportDocumentPdf(
      makeModel({ sections: [] }),
    );
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
