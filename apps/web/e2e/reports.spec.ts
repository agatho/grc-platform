/**
 * Standard-Reports (2026-07-11 Report-Builder): risk-register, SoA,
 * compliance-status — PDF/XLSX output contracts + style variants.
 *
 * API-first, read-only (no test data created — the reports aggregate
 * whatever the org contains, including zero rows):
 *   1. /reports/risk-register?format=pdf  → %PDF magic bytes
 *   2. /reports/risk-register?format=xlsx → PK (zip) magic bytes
 *   3. /reports/soa + /reports/compliance-status against the first
 *      seeded control framework (from /api/v1/catalogs?type=control);
 *      skips with a reason when no framework is seeded
 *   4. ?style=formal produces a larger PDF than ?style=minimal
 *      (formal adds cover page + TOC; minimal drops logo/chrome)
 */
import { test, expect } from "@playwright/test";

const PDF_MAGIC = "%PDF";
const XLSX_MAGIC = "PK";

test.describe("Reporting — standard reports (PDF/XLSX contracts)", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("risk-register: PDF + XLSX magic bytes and content types", async ({
    request,
  }) => {
    const pdfRes = await request.get("/api/v1/reports/risk-register?format=pdf");
    expect(pdfRes.ok(), await pdfRes.text()).toBeTruthy();
    expect(pdfRes.headers()["content-type"]).toContain("application/pdf");
    const pdfBody = await pdfRes.body();
    expect(pdfBody.subarray(0, 4).toString()).toBe(PDF_MAGIC);
    expect(pdfBody.length).toBeGreaterThan(500);

    const xlsxRes = await request.get(
      "/api/v1/reports/risk-register?format=xlsx",
    );
    expect(xlsxRes.ok(), await xlsxRes.text()).toBeTruthy();
    const xlsxBody = await xlsxRes.body();
    expect(xlsxBody.subarray(0, 2).toString()).toBe(XLSX_MAGIC);
  });

  test("soa + compliance-status against the first seeded framework", async ({
    request,
  }) => {
    // Framework list — the SoA report keys on catalog.id (46 seeded
    // control frameworks in a full dev setup).
    const catRes = await request.get("/api/v1/catalogs?type=control&limit=50");
    expect(catRes.ok(), await catRes.text()).toBeTruthy();
    const catalogs: Array<{ id: string; name: string }> = (
      await catRes.json()
    ).data;
    test.skip(
      !catalogs || catalogs.length === 0,
      "No control-framework catalog seeded in this org — run the catalog seeds (packages/db/sql) first.",
    );
    const frameworkId = catalogs[0].id;

    const soaRes = await request.get(
      `/api/v1/reports/soa?frameworkId=${frameworkId}&format=pdf`,
    );
    expect(soaRes.ok(), await soaRes.text()).toBeTruthy();
    expect(soaRes.headers()["content-type"]).toContain("application/pdf");
    expect((await soaRes.body()).subarray(0, 4).toString()).toBe(PDF_MAGIC);

    const csRes = await request.get(
      `/api/v1/reports/compliance-status?frameworkId=${frameworkId}&format=pdf`,
    );
    expect(csRes.ok(), await csRes.text()).toBeTruthy();
    expect(csRes.headers()["content-type"]).toContain("application/pdf");
    expect((await csRes.body()).subarray(0, 4).toString()).toBe(PDF_MAGIC);

    // XLSX variant of the SoA works too
    const soaXlsx = await request.get(
      `/api/v1/reports/soa?frameworkId=${frameworkId}&format=xlsx`,
    );
    expect(soaXlsx.ok(), await soaXlsx.text()).toBeTruthy();
    expect((await soaXlsx.body()).subarray(0, 2).toString()).toBe(XLSX_MAGIC);
  });

  test("style variants: formal PDF is larger than minimal", async ({
    request,
  }) => {
    const formalRes = await request.get(
      "/api/v1/reports/risk-register?format=pdf&style=formal",
    );
    expect(formalRes.ok(), await formalRes.text()).toBeTruthy();
    const formal = await formalRes.body();
    expect(formal.subarray(0, 4).toString()).toBe(PDF_MAGIC);

    const minimalRes = await request.get(
      "/api/v1/reports/risk-register?format=pdf&style=minimal",
    );
    expect(minimalRes.ok(), await minimalRes.text()).toBeTruthy();
    const minimal = await minimalRes.body();
    expect(minimal.subarray(0, 4).toString()).toBe(PDF_MAGIC);

    // formal = cover page + TOC + wider spacing; minimal = no logo,
    // compact chrome → formal must be strictly larger.
    expect(formal.length).toBeGreaterThan(minimal.length);
  });
});
