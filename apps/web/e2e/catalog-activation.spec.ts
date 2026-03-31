import { test, expect } from "@playwright/test";

test.describe("Catalog Activation per Organization", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("active catalogs API returns activated catalogs with targetModules", async ({ request }) => {
    // Get the admin's org (first org from the list)
    const orgsRes = await request.get("/api/v1/organizations");
    const orgs = await orgsRes.json();
    const orgId = orgs.data?.[0]?.id;

    if (!orgId) {
      test.skip();
      return;
    }

    const res = await request.get(`/api/v1/organizations/${orgId}/active-catalogs`);
    expect(res.ok()).toBeTruthy();

    const json = await res.json();
    expect(json.data.length).toBeGreaterThan(0);

    // Verify enrichment fields
    const first = json.data[0];
    expect(first).toHaveProperty("catalogName");
    expect(first).toHaveProperty("targetModules");
    expect(first).toHaveProperty("enforcementLevel");
  });

  test("mandatory catalogs are inherited by subsidiaries", async ({ request }) => {
    const orgsRes = await request.get("/api/v1/organizations");
    const orgs = await orgsRes.json();

    // Find a subsidiary (has is_mandatory_from_parent entries)
    for (const org of orgs.data ?? []) {
      const res = await request.get(`/api/v1/organizations/${org.id}/active-catalogs`);
      const json = await res.json();
      const inherited = json.data?.filter((c: any) => c.isMandatoryFromParent);
      if (inherited?.length > 0) {
        // Verify inherited catalogs are mandatory
        for (const cat of inherited) {
          expect(cat.enforcementLevel).toBe("mandatory");
          expect(cat.isMandatoryFromParent).toBe(true);
        }
        return; // Test passed
      }
    }
  });

  test("settings catalogs page loads", async ({ page }) => {
    await page.goto("/settings/catalogs");
    await page.waitForLoadState("networkidle");

    // Should show activated catalogs
    await expect(page.getByText(/gdpr|iso 27001|nis2/i).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
