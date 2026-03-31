import { test, expect } from "@playwright/test";

test.describe("Catalog Browser", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("risk catalogs API returns seeded data", async ({ request }) => {
    const res = await request.get("/api/v1/catalogs/risks?limit=50");
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    expect(json.data.length).toBeGreaterThanOrEqual(5);

    // Verify key catalogs exist
    const sources = json.data.map((c: any) => c.source);
    expect(sources).toContain("cambridge_taxonomy_v2");
    expect(sources).toContain("mitre_attack_enterprise");
    expect(sources).toContain("bsi_itgs_elementar");
  });

  test("control catalogs API returns seeded data", async ({ request }) => {
    const res = await request.get("/api/v1/catalogs/controls?limit=50");
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    expect(json.data.length).toBeGreaterThanOrEqual(10);

    const sources = json.data.map((c: any) => c.source);
    expect(sources).toContain("eu_gdpr");
    expect(sources).toContain("iso_27001_2022_annex_a");
    expect(sources).toContain("bsi_itgs_bausteine");
    expect(sources).toContain("eu_nis2");
  });

  test("catalog entries API returns hierarchical data", async ({ request }) => {
    // Get GDPR catalog ID
    const catalogs = await (await request.get("/api/v1/catalogs/controls?source=eu_gdpr")).json();
    const gdprId = catalogs.data[0]?.id;
    expect(gdprId).toBeTruthy();

    // Get root entries
    const entries = await (
      await request.get(`/api/v1/catalogs/controls/${gdprId}/entries?parentEntryId=root&limit=50`)
    ).json();
    expect(entries.data.length).toBeGreaterThan(0);

    // Verify entries have expected structure
    const first = entries.data[0];
    expect(first).toHaveProperty("code");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("level");
  });

  test("module filter works on catalog API", async ({ request }) => {
    const res = await request.get("/api/v1/catalogs/risks?module=isms");
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    // All returned catalogs should target ISMS
    for (const cat of json.data) {
      expect(cat.targetModules).toContain("isms");
    }
  });

  test("cross-framework mappings API returns data", async ({ request }) => {
    const res = await request.get("/api/v1/catalogs/mappings?catalogSource=iso_27001_2022_annex_a");
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(50); // ISO 27001 has 93+ mappings
  });

  test("catalog browser page loads and shows catalogs", async ({ page }) => {
    await page.goto("/catalogs/risks");
    await page.waitForLoadState("networkidle");

    // Should show at least one catalog
    await expect(page.getByText(/cambridge|mitre|bsi|wef/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("framework coverage page loads", async ({ page }) => {
    await page.goto("/catalogs/mappings");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/framework/i).first()).toBeVisible();
  });
});
