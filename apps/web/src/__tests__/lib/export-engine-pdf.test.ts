// Export Engine — PDF format respects format=pdf (Wave-21-B9)
//
// Wave-21 QA verified that GET /export/risk?format=pdf returned
// content-type: text/csv (the format parameter was being silently
// ignored — the case fell through to CSV in export-engine.ts). This
// test pins the fix: format=pdf now produces a real PDF buffer with
// content-type: application/pdf and correct PDF magic bytes.

import { describe, it, expect, vi } from "vitest";

// Stub the @grc/db module — the export engine queries the entity
// table generically and we just need it to return a few rows.
vi.mock("@grc/db", () => ({
  get db() {
    return {
      execute: vi.fn(async (q: unknown) => {
        const text = String(q);
        // Soft-delete probe runs first; return one row to indicate
        // the column exists.
        if (text.includes("information_schema")) return [{ "?column?": 1 }];
        // The actual data query — return 3 sample rows.
        return [
          {
            id: "r1",
            title: "Risk One",
            risk_category: "operational",
            status: "identified",
            created_at: new Date(),
          },
          {
            id: "r2",
            title: "Risk Two",
            risk_category: "strategic",
            status: "assessed",
            created_at: new Date(),
          },
          {
            id: "r3",
            title: "Risk Three",
            risk_category: "compliance",
            status: "treated",
            created_at: new Date(),
          },
        ];
      }),
    };
  },
  dataExportLog: {},
}));

vi.mock("drizzle-orm", () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
    {
      raw: (s: string) => ({ raw: s }),
    },
  ),
}));

describe("Export engine PDF format (Wave-21-B9)", () => {
  it("format='pdf' produces a buffer with PDF magic bytes", async () => {
    const { exportEntities } =
      await import("../../lib/import-export/export-engine");
    const result = await exportEntities("risk", "pdf", {}, "org-123");

    expect(result.contentType).toBe("application/pdf");
    expect(result.fileName).toMatch(/\.pdf$/);
    // PDF magic bytes %PDF-
    expect(result.data[0]).toBe(0x25); // %
    expect(result.data[1]).toBe(0x50); // P
    expect(result.data[2]).toBe(0x44); // D
    expect(result.data[3]).toBe(0x46); // F
    expect(result.data[4]).toBe(0x2d); // -
    expect(result.rowCount).toBe(3);
  });

  it("format='csv' still produces CSV (no regression)", async () => {
    const { exportEntities } =
      await import("../../lib/import-export/export-engine");
    const result = await exportEntities("risk", "csv", {}, "org-123");

    expect(result.contentType).toMatch(/text\/csv/);
    expect(result.fileName).toMatch(/\.csv$/);
    // CSV starts with the header row, NOT %PDF-.
    expect(result.data[0]).not.toBe(0x25);
  });

  // ExcelJS cold import takes 5-10s under vitest's worker pool — the
  // default 5s timeout flakes on the very first test that loads it.
  it(
    "format='xlsx' still produces XLSX (no regression)",
    { timeout: 15_000 },
    async () => {
      const { exportEntities } =
        await import("../../lib/import-export/export-engine");
      const result = await exportEntities("risk", "xlsx", {}, "org-123");

      expect(result.contentType).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      expect(result.fileName).toMatch(/\.xlsx$/);
      // XLSX is a ZIP — magic bytes PK
      expect(result.data[0]).toBe(0x50); // P
      expect(result.data[1]).toBe(0x4b); // K
    },
  );

  it("format='unknown' throws a clear error", async () => {
    const { exportEntities } =
      await import("../../lib/import-export/export-engine");
    await expect(exportEntities("risk", "doc", {}, "org-123")).rejects.toThrow(
      /Unsupported format/,
    );
  });
});
