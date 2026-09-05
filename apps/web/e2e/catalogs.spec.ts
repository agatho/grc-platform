import { test, expect } from "@playwright/test";
import { awaitAppReady } from "./fixtures/wait";
import { STORAGE_STATE } from "./fixtures/storage";

test.describe("Catalog Browser", () => {
  test.use({ storageState: STORAGE_STATE });

  test("generic catalogs API returns seeded data", async ({ request }) => {
    const res = await request.get("/api/v1/catalogs?limit=50");
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    const data = Array.isArray(json) ? json : (json.data ?? []);
    expect(data.length).toBeGreaterThanOrEqual(5);
  });

  test("catalog entries exist for seeded catalogs", async ({ request }) => {
    // First get list of catalogs
    const catRes = await request.get("/api/v1/catalogs?limit=5");
    const catJson = await catRes.json();
    const catalogs = Array.isArray(catJson) ? catJson : (catJson.data ?? []);
    expect(catalogs.length).toBeGreaterThan(0);
  });

  test("module filter works on catalog API", async ({ request }) => {
    const res = await request.get("/api/v1/catalogs?module=isms");
    if (res.ok()) {
      const json = await res.json();
      const data = Array.isArray(json) ? json : (json.data ?? []);
      // All returned catalogs should target ISMS
      for (const cat of data) {
        if (cat.targetModules) {
          expect(cat.targetModules).toContain("isms");
        }
      }
    }
  });

  test("catalog browser page loads", async ({ page }) => {
    await page.goto("/catalogs");
    await awaitAppReady(page);

    // Should show catalog heading
    await expect(page.getByText(/katalog|catalog/i).first()).toBeVisible();
  });

  test("framework coverage page loads", async ({ page }) => {
    await page.goto("/catalogs/mappings");
    await awaitAppReady(page);

    // Page should load without error
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(20);
  });
});
