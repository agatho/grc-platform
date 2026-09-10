import { test, expect } from "@playwright/test";
import { awaitAppReady } from "./fixtures/wait";
import { STORAGE_STATE } from "./fixtures/storage";

test.describe("Catalog Activation per Organization", () => {
  test.use({ storageState: STORAGE_STATE });

  test("module configs include all seeded modules", async ({ request }) => {
    const session = await (await request.get("/api/auth/session")).json();
    const orgId = session?.user?.roles?.[0]?.orgId;
    expect(orgId).toBeTruthy();

    const res = await request.get(`/api/v1/organizations/${orgId}/modules`);
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    const data = Array.isArray(json) ? json : (json.data ?? []);
    expect(data.length).toBeGreaterThan(0);

    // All modules should be enabled
    for (const mod of data) {
      expect(mod.uiStatus).toBe("enabled");
    }
  });

  test("catalogs page loads", async ({ page }) => {
    await page.goto("/catalogs");
    await awaitAppReady(page);

    await expect(page.getByText(/katalog|catalog/i).first()).toBeVisible();
  });
});
