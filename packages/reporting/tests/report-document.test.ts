// Template → ReportDocument model mapping. Explicit assertions (no
// snapshot files) — this model is the contract between the template
// engine (packages/reporting, also used by the worker cron) and the
// pdfkit renderers that replaced the Puppeteer HTML path.
//
// Pure: buildReportDocument touches neither DB nor renderer.

import { describe, it, expect } from "vitest";
import {
  buildReportDocument,
  type ResolvedSection,
} from "../src/report-document";

const GENERATED_AT = new Date("2026-07-11T09:30:00.000Z");

function build(
  sections: ResolvedSection[],
  branding?: Parameters<typeof buildReportDocument>[1],
) {
  return buildReportDocument(sections, branding, { generatedAt: GENERATED_AT });
}

describe("buildReportDocument — section mapping", () => {
  it("maps title → heading and text → paragraph, preferring resolved content", () => {
    const doc = build([
      {
        type: "title",
        config: { text: "Report — {{org.name}}" },
        content: "Report — Meridian Holdings",
      },
      { type: "text", config: { text: "Fallback body" } },
    ]);
    expect(doc.sections).toEqual([
      { kind: "heading", text: "Report — Meridian Holdings" },
      { kind: "paragraph", text: "Fallback body" },
    ]);
  });

  it("maps kpi sections with value, label and trend", () => {
    const doc = build([
      {
        type: "kpi",
        config: { dataSource: "erm.risk_count" },
        value: { value: 42, label: "Total Risks", trend: "stable" },
      },
    ]);
    expect(doc.sections).toEqual([
      { kind: "kpi", label: "Total Risks", value: 42, trend: "stable" },
    ]);
  });

  it("falls back to config.label and 0 when a KPI resolved no value", () => {
    const doc = build([
      { type: "kpi", config: { dataSource: "x", label: "Posture" } },
    ]);
    expect(doc.sections[0]).toEqual({
      kind: "kpi",
      label: "Posture",
      value: 0,
      trend: undefined,
    });
  });

  it("maps tables and resolves cells via header → snake_case key fallback", () => {
    const doc = build([
      {
        type: "table",
        config: { dataSource: "erm.risk_register", label: "Risk Register" },
        data: {
          headers: ["Element ID", "Title", "Score"],
          rows: [
            // snake_case keys (SQL row) — resolved via lowercase fallback
            { element_id: "RSK00000001", title: "Leak", score: 16 },
            // exact-header keys — resolved directly
            { "Element ID": "RSK00000002", Title: "Fire", Score: 9 },
          ],
        },
      },
    ]);
    expect(doc.sections).toEqual([
      {
        kind: "table",
        title: "Risk Register",
        headers: ["Element ID", "Title", "Score"],
        rows: [
          ["RSK00000001", "Leak", 16],
          ["RSK00000002", "Fire", 9],
        ],
      },
    ]);
  });

  it("keeps numbers as numbers and maps missing cells to null", () => {
    const doc = build([
      {
        type: "table",
        config: { dataSource: "x" },
        data: { headers: ["Count", "Note"], rows: [{ count: 7 }] },
      },
    ]);
    const table = doc.sections[0];
    if (table?.kind !== "table") throw new Error("expected table");
    expect(table.rows).toEqual([[7, null]]);
  });

  it("maps an unresolved table to empty headers/rows (never throws)", () => {
    const doc = build([{ type: "table", config: { dataSource: "unknown" } }]);
    expect(doc.sections[0]).toEqual({
      kind: "table",
      title: undefined,
      headers: [],
      rows: [],
    });
  });

  it("maps charts with labels, datasets and chartType (default bar)", () => {
    const doc = build([
      {
        type: "chart",
        config: { dataSource: "erm.risk_by_category", label: "By Category" },
        data: {
          labels: ["cyber", "operational"],
          datasets: [{ label: "Risks", data: [5, 3] }],
        },
      },
    ]);
    expect(doc.sections).toEqual([
      {
        kind: "chart",
        title: "By Category",
        chartType: "bar",
        labels: ["cyber", "operational"],
        datasets: [{ label: "Risks", data: [5, 3] }],
      },
    ]);
  });

  it("maps page_break → pageBreak and skips unknown section types", () => {
    const doc = build([
      { type: "page_break", config: {} },
      {
        type: "unknown_future_type" as ResolvedSection["type"],
        config: {},
      },
    ]);
    expect(doc.sections).toEqual([{ kind: "pageBreak" }]);
  });
});

describe("buildReportDocument — metadata + branding", () => {
  it("serialises generatedAt as the injected ISO timestamp", () => {
    const doc = build([]);
    expect(doc.generatedAt).toBe("2026-07-11T09:30:00.000Z");
  });

  it("defaults branding when none is configured", () => {
    const doc = build([]);
    expect(doc.branding).toEqual({
      primaryColor: "#1e3a5f",
      footerText: null,
      confidentiality: null,
      logoUrl: null,
    });
  });

  it("passes configured branding through", () => {
    const doc = build([], {
      primaryColor: "#123456",
      footerText: "ARCTOS GRC",
      confidentiality: "Vertraulich",
      logoUrl: "https://example.com/logo.png",
    });
    expect(doc.branding).toEqual({
      primaryColor: "#123456",
      footerText: "ARCTOS GRC",
      confidentiality: "Vertraulich",
      logoUrl: "https://example.com/logo.png",
    });
  });

  it("produces a JSON-serialisable model (round-trips)", () => {
    const doc = build([
      { type: "title", config: { text: "T" } },
      { type: "page_break", config: {} },
    ]);
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });
});
