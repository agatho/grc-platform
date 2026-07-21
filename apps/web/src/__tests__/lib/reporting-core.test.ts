// Report core — pure layout logic (column widths, wrap estimation,
// table pagination), DE/EN formatting, and render contracts:
// PDF output starts with %PDF / ends with %%EOF and breaks large
// tables across pages; XLSX output carries the PK zip magic.

import { describe, it, expect } from "vitest";
import {
  computeColumnWidths,
  estimateLines,
  formatCell,
  paginateRows,
  reportFileResponse,
  XLSX_MIME,
  type ReportBranding,
  type ReportColumn,
  type ReportDefinition,
} from "../../lib/reporting/core";
import { renderReportPdf } from "../../lib/reporting/pdf-renderer";
import { renderReportXlsx } from "../../lib/reporting/excel-renderer";
import { severityBand } from "../../lib/reporting/labels";

const branding: ReportBranding = {
  orgName: "Meridian Holdings GmbH",
  primaryColor: "#1e3a5f",
  confidentialityNotice: "VERTRAULICH — nur für den internen Gebrauch",
  logoFilePath: null,
};

function makeDef(rowCount: number): ReportDefinition {
  const columns: ReportColumn[] = [
    { key: "id", label: "ID", width: 1 },
    { key: "title", label: "Titel", width: 3 },
    { key: "score", label: "Score", width: 1, format: "int" },
    { key: "date", label: "Review", width: 1.2, format: "date" },
  ];
  return {
    title: "Risikobericht",
    subtitle: "Testlauf",
    locale: "de",
    branding,
    generatedAt: new Date("2026-07-11T09:30:00Z"),
    sections: [
      { kind: "paragraph", text: "Executive Summary Absatz." },
      {
        kind: "kpis",
        items: [
          { label: "Gesamt", value: rowCount },
          { label: "Kritisch", value: 3, tone: "crit" },
        ],
      },
      {
        kind: "bars",
        title: "Erfüllungsgrad",
        items: [
          { label: "Kap. 5 Organisatorisch", percent: 82.5, detail: "33/40" },
          { label: "Kap. 8 Technisch", percent: 41 },
        ],
      },
      {
        kind: "table",
        title: "Register",
        table: {
          columns,
          rows: Array.from({ length: rowCount }, (_, i) => [
            `RSK${String(i + 1).padStart(8, "0")}`,
            `Risiko ${i + 1} — eine längere Beschreibung, die umbricht, damit Zeilenhöhen variieren`,
            (i * 7) % 25,
            new Date("2026-09-01"),
          ]),
        },
      },
    ],
  };
}

describe("computeColumnWidths", () => {
  it("distributes by weight and sums exactly to totalWidth", () => {
    const widths = computeColumnWidths(
      [
        { key: "a", label: "A", width: 1 },
        { key: "b", label: "B", width: 3 },
      ],
      495,
    );
    expect(widths).toHaveLength(2);
    expect(widths[0] + widths[1]).toBe(495);
    expect(widths[1]).toBeGreaterThan(widths[0] * 2);
  });

  it("defaults missing weights to 1", () => {
    const widths = computeColumnWidths(
      [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
      ],
      100,
    );
    expect(widths[0] + widths[1]).toBe(100);
    expect(Math.abs(widths[0] - widths[1])).toBeLessThanOrEqual(1);
  });

  it("returns empty for no columns", () => {
    expect(computeColumnWidths([], 495)).toEqual([]);
  });
});

describe("estimateLines", () => {
  it("returns 1 for empty text", () => {
    expect(estimateLines("", 100)).toBe(1);
  });

  it("grows with text length and shrinks with column width", () => {
    const short = estimateLines("kurz", 100);
    const long = estimateLines("x".repeat(400), 100);
    const longWide = estimateLines("x".repeat(400), 400);
    expect(short).toBe(1);
    expect(long).toBeGreaterThan(longWide);
  });

  it("counts explicit newlines", () => {
    expect(estimateLines("a\nb\nc", 500)).toBeGreaterThanOrEqual(3);
  });
});

describe("paginateRows", () => {
  it("keeps everything on one page when it fits", () => {
    expect(paginateRows([1, 1, 1], 10, 10)).toEqual([[0, 1, 2]]);
  });

  it("breaks across pages by line budget", () => {
    const chunks = paginateRows([2, 2, 2, 2, 2], 4, 4);
    expect(chunks).toEqual([[0, 1], [2, 3], [4]]);
  });

  it("uses the larger capacity for subsequent pages", () => {
    const chunks = paginateRows([1, 1, 1, 1, 1, 1], 2, 4);
    expect(chunks).toEqual([
      [0, 1],
      [2, 3, 4, 5],
    ]);
  });

  it("never emits an empty chunk even for oversized rows", () => {
    const chunks = paginateRows([50, 50], 10, 10);
    expect(chunks).toEqual([[0], [1]]);
  });
});

describe("formatCell DE/EN", () => {
  it("formats integers with locale grouping", () => {
    expect(formatCell(1234567, "int", "de")).toBe("1.234.567");
    expect(formatCell(1234567, "int", "en")).toBe("1,234,567");
  });

  it("formats decimals per locale", () => {
    expect(formatCell(1234.5, "decimal", "de")).toBe("1.234,50");
    expect(formatCell(1234.5, "decimal", "en")).toBe("1,234.50");
  });

  it("formats dates per locale convention", () => {
    const d = new Date(2026, 2, 25); // 25 March 2026, local time
    expect(formatCell(d, "date", "de")).toBe("25.03.2026");
    expect(formatCell(d, "date", "en")).toBe("03/25/2026");
  });

  it("formats percent per locale", () => {
    expect(formatCell(85.5, "percent", "en")).toBe("85.5%");
    expect(formatCell(85.5, "percent", "de")).toContain("85,5");
  });

  it("renders null/undefined/empty as empty string", () => {
    expect(formatCell(null, "int", "de")).toBe("");
    expect(formatCell(undefined, "date", "de")).toBe("");
    expect(formatCell("", "text", "de")).toBe("");
  });
});

describe("severityBand", () => {
  it("maps the 5x5 score to bands", () => {
    expect(severityBand(null)).toBe("unrated");
    expect(severityBand(1)).toBe("low");
    expect(severityBand(4)).toBe("medium");
    expect(severityBand(8)).toBe("high");
    expect(severityBand(15)).toBe("critical");
    expect(severityBand(25)).toBe("critical");
  });
});

describe("renderReportPdf", () => {
  it("produces a valid PDF with magic bytes and EOF", async () => {
    const buffer = await renderReportPdf(makeDef(5));
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.subarray(-32).toString("latin1")).toContain("%%EOF");
  });

  it("breaks a large table across multiple pages", async () => {
    const small = await renderReportPdf(makeDef(3));
    const large = await renderReportPdf(makeDef(150));
    const countPages = (buf: Buffer): number =>
      (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(countPages(small)).toBeGreaterThanOrEqual(1);
    expect(countPages(large)).toBeGreaterThan(countPages(small));
  });

  it("renders empty tables without throwing", async () => {
    const def = makeDef(0);
    const buffer = await renderReportPdf(def);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

describe("renderReportXlsx", () => {
  it("produces a workbook with PK zip magic", async () => {
    const buffer = await renderReportXlsx(makeDef(5));
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("renders empty tables without throwing", async () => {
    const buffer = await renderReportXlsx(makeDef(0));
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});

describe("reportFileResponse", () => {
  it("sets PDF content type + sanitized filename", async () => {
    const res = reportFileResponse(
      Buffer.from("%PDF-1.3"),
      "risk report!",
      "pdf",
    );
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="risk_report_.pdf"',
    );
  });

  it("sets XLSX MIME for excel", () => {
    const res = reportFileResponse(Buffer.from("PK"), "soa", "xlsx");
    expect(res.headers.get("Content-Type")).toBe(XLSX_MIME);
    expect(res.headers.get("Content-Disposition")).toContain(".xlsx");
  });
});
