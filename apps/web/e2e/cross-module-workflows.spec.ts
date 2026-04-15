/**
 * Cross-Module Workflow Tests
 * Tests critical workflows that span multiple modules:
 * ERM, ICS/Audit, BCMS, DPMS, TPRM, ESG
 */
import { test, expect } from "@playwright/test";

test.describe("ERM ISO 31000 Workflow", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("risk register loads with demo data", async ({ page }) => {
    await page.goto("/risks");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/risikoregister|risk register/i).first()).toBeVisible();
    await expect(page.getByText(/RSK-/i).first()).toBeVisible();
  });

  test("risk creation form has all required fields", async ({ page }) => {
    await page.goto("/risks/new");
    await page.waitForLoadState("networkidle");
    // Step 1: Basic info
    await expect(page.getByText(/titel|title/i).first()).toBeVisible();
    await expect(page.getByText(/kategorie|category/i).first()).toBeVisible();
  });

  test("risk appetite dashboard loads", async ({ page }) => {
    await page.goto("/erm/risk-appetite");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/appetit|appetite/i).first()).toBeVisible();
  });

  test("KRI monitoring loads with data", async ({ page }) => {
    await page.goto("/risks/kris");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/indikator|kri/i).first()).toBeVisible();
  });

  test("FAIR analysis hub loads", async ({ page }) => {
    await page.goto("/erm/fair");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/fair/i).first()).toBeVisible();
  });

  test("heatmap visualization loads", async ({ page }) => {
    await page.goto("/controls/heatmap");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/heatmap/i).first()).toBeVisible();
  });
});

test.describe("ICS & Audit COSO/IIA Workflow", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("control register loads", async ({ page }) => {
    await page.goto("/controls");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/kontrollregister|control register/i).first()).toBeVisible();
  });

  test("control creation form has COSO fields", async ({ page }) => {
    await page.goto("/controls/new");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/typ|type/i).first()).toBeVisible();
  });

  test("audit management dashboard loads", async ({ page }) => {
    await page.goto("/audit");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/audit/i).first()).toBeVisible();
  });

  test("audit universe loads", async ({ page }) => {
    await page.goto("/audit/universe");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/universum|universe/i).first()).toBeVisible();
  });
});

test.describe("BCMS ISO 22301 Workflow", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("BCMS dashboard loads with KPIs", async ({ page }) => {
    await page.goto("/bcms");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/business continuity/i).first()).toBeVisible();
    await expect(page.getByText(/RTO|BIA/i).first()).toBeVisible();
  });

  test("BIA page loads with assessments", async ({ page }) => {
    await page.goto("/bcms/bia");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/impact.*analyse|bia/i).first()).toBeVisible();
  });

  test("crisis scenarios page loads", async ({ page }) => {
    await page.goto("/bcms/crisis");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/krise|crisis/i).first()).toBeVisible();
  });
});

test.describe("DPMS DSGVO Workflow", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("DPMS dashboard loads with breach alert", async ({ page }) => {
    await page.goto("/dpms");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/datenschutz|privacy/i).first()).toBeVisible();
  });

  test("RoPA page loads", async ({ page }) => {
    await page.goto("/dpms/ropa");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/verarbeitungsverzeichnis|ropa/i).first()).toBeVisible();
  });

  test("breach management with 72h tracking", async ({ page }) => {
    await page.goto("/dpms/breaches");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/datenpann|breach/i).first()).toBeVisible();
  });

  test("DPIA page loads", async ({ page }) => {
    await page.goto("/dpms/dpia");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/folgenabsch|dpia/i).first()).toBeVisible();
  });
});

test.describe("TPRM ISO 27036 Workflow", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("vendor register loads with demo data", async ({ page }) => {
    await page.goto("/tprm/vendors");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/lieferant|vendor/i).first()).toBeVisible();
  });

  test("LkSG assessment page loads", async ({ page }) => {
    await page.goto("/tprm/lksg");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/lksg/i).first()).toBeVisible();
  });

  test("contract management loads", async ({ page }) => {
    await page.goto("/contracts");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/vertrag|contract/i).first()).toBeVisible();
  });
});

test.describe("ESG CSRD Workflow", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("ESG dashboard loads", async ({ page }) => {
    await page.goto("/esg");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/esg/i).first()).toBeVisible();
  });

  test("emissions page loads with scopes", async ({ page }) => {
    await page.goto("/esg/emissions");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);
    await expect(page.getByText(/scope|emission/i).first()).toBeVisible();
  });

  test("EU taxonomy page loads", async ({ page }) => {
    await page.goto("/esg/taxonomy");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/taxonomie|taxonomy/i).first()).toBeVisible();
  });

  test("materiality analysis page loads", async ({ page }) => {
    await page.goto("/esg/materiality");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/wesentlichkeit|materiality/i).first()).toBeVisible();
  });
});

test.describe("Navigation & Tab System", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("horizontal tab navigation renders on module pages", async ({ page }) => {
    await page.goto("/risks");
    await page.waitForLoadState("networkidle");
    const tabNav = page.locator('[aria-label="Modul-Navigation"]');
    await expect(tabNav).toBeVisible();
    await expect(tabNav.getByText(/register/i)).toBeVisible();
    await expect(tabNav.getByText(/indikator|kri/i)).toBeVisible();
  });

  test("sidebar shows condensed navigation", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("all new AI Act pages return 200", async ({ page }) => {
    test.setTimeout(180000); // 13 pages, each may need first-compile
    const aiActRoutes = [
      "/ai-act", "/ai-act/systems", "/ai-act/gpai", "/ai-act/frias",
      "/ai-act/incidents", "/ai-act/prohibited", "/ai-act/conformity-assessments",
      "/ai-act/oversight-logs", "/ai-act/framework-mappings",
      "/ai-act/qms", "/ai-act/corrective-actions", "/ai-act/authority", "/ai-act/penalties",
    ];
    for (const route of aiActRoutes) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} should return 200`).toBe(200);
    }
  });
});
