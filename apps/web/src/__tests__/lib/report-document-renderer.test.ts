// Web adapter for the neutral ReportDocument model (@grc/reporting):
// mapping onto the hardened report core + branded pdfkit rendering.

import { describe, it, expect } from "vitest";
import type { ReportDocument } from "@grc/reporting";
import {
  renderReportDocument,
  reportDocumentToDefinition,
} from "../../lib/reporting/report-document-renderer";

function makeModel(): ReportDocument {
  return {
    generatedAt: "2026-07-11T09:30:00.000Z",
    branding: {
      primaryColor: "#123456",
      footerText: "ARCTOS GRC",
      confidentiality: "Vertraulich",
      logoUrl: null,
    },
    sections: [
      { kind: "heading", text: "ISMS Quartalsbericht" },
      { kind: "paragraph", text: "Zusammenfassung." },
      { kind: "kpi", label: "Total Risks", value: 42 },
      { kind: "kpi", label: "High Risks", value: 7 },
      {
        kind: "table",
        title: "Register",
        headers: ["ID", "Titel"],
        rows: [["RSK00000001", "Leck"]],
      },
      {
        kind: "chart",
        title: "Nach Kategorie",
        chartType: "bar",
        labels: ["cyber", "ops"],
        datasets: [{ label: "Risks", data: [8, 4] }],
      },
      { kind: "pageBreak" },
      { kind: "paragraph", text: "Anhang." },
    ],
  };
}

describe("reportDocumentToDefinition", () => {
  it("uses the first heading as document title and drops it from the body", () => {
    const def = reportDocumentToDefinition(makeModel());
    expect(def.title).toBe("ISMS Quartalsbericht");
    expect(
      def.sections.some(
        (s) => s.kind === "heading" && s.text === "ISMS Quartalsbericht",
      ),
    ).toBe(false);
  });

  it("keeps the heading in the body when an explicit title is given", () => {
    const def = reportDocumentToDefinition(makeModel(), { title: "Custom" });
    expect(def.title).toBe("Custom");
    expect(
      def.sections.some(
        (s) => s.kind === "heading" && s.text === "ISMS Quartalsbericht",
      ),
    ).toBe(true);
  });

  it("coalesces consecutive kpi sections into one KPI card row", () => {
    const def = reportDocumentToDefinition(makeModel());
    const kpiSections = def.sections.filter((s) => s.kind === "kpis");
    expect(kpiSections).toHaveLength(1);
    const kpis = kpiSections[0];
    if (kpis?.kind !== "kpis") throw new Error("expected kpis");
    expect(kpis.items).toEqual([
      { label: "Total Risks", value: 42 },
      { label: "High Risks", value: 7 },
    ]);
  });

  it("maps single-series bar charts to percent bars scaled to the max", () => {
    const def = reportDocumentToDefinition(makeModel());
    const bars = def.sections.find((s) => s.kind === "bars");
    if (bars?.kind !== "bars") throw new Error("expected bars");
    expect(bars.title).toBe("Nach Kategorie");
    expect(bars.items).toEqual([
      { label: "cyber", percent: 100, detail: "8" },
      { label: "ops", percent: 50, detail: "4" },
    ]);
  });

  it("falls back to a value table for non-bar charts", () => {
    const model = makeModel();
    model.sections = [
      {
        kind: "chart",
        title: "Trend",
        chartType: "line",
        labels: ["2026-01"],
        datasets: [{ label: "New", data: [3] }],
      },
    ];
    const def = reportDocumentToDefinition(model);
    const table = def.sections.find((s) => s.kind === "table");
    if (table?.kind !== "table") throw new Error("expected table");
    expect(table.table.columns.map((c) => c.label)).toEqual(["Label", "New"]);
    expect(table.table.rows).toEqual([["2026-01", 3]]);
  });

  it("maps tables, page breaks and branding metadata", () => {
    const def = reportDocumentToDefinition(makeModel());
    expect(def.sections.some((s) => s.kind === "pageBreak")).toBe(true);
    const table = def.sections.find((s) => s.kind === "table");
    if (table?.kind !== "table") throw new Error("expected table");
    expect(table.table.columns.map((c) => c.label)).toEqual(["ID", "Titel"]);
    expect(def.branding.primaryColor).toBe("#123456");
    expect(def.branding.confidentialityNotice).toBe("Vertraulich");
    expect(def.branding.logoFilePath).toBeNull();
    expect(def.generatedAt.toISOString()).toBe("2026-07-11T09:30:00.000Z");
  });
});

describe("renderReportDocument", () => {
  it("renders the model to a valid PDF (%PDF magic, multi-page)", async () => {
    const buffer = await renderReportDocument(makeModel());
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.subarray(-32).toString("latin1")).toContain("%%EOF");
    // pageBreak in the model → at least 2 pages
    const pages = buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(2);
  });

  it("applies style options (formal cover/TOC)", async () => {
    const standard = await renderReportDocument(makeModel());
    const formal = await renderReportDocument(makeModel(), {
      style: "formal",
    });
    const count = (buf: Buffer): number =>
      (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(count(formal)).toBeGreaterThanOrEqual(count(standard) + 2);
  });
});
