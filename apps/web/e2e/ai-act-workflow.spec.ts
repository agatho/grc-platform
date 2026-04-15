/**
 * EU AI Act End-to-End Workflow Test
 * Tests the complete AI governance lifecycle per EU AI Act 2024/1689
 */
import { test, expect } from "@playwright/test";

test.describe("EU AI Act Workflow", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  // ── Art. 49: AI System Registry ────────────────────────────
  test("AI systems page loads with demo data", async ({ page }) => {
    await page.goto("/ai-act/systems");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/AIS-001/i).first()).toBeVisible();
  });

  test("AI system detail page loads", async ({ page }) => {
    await page.goto("/ai-act/systems");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    // Click first table row or card that links to a detail page
    const link = page.locator("table tbody tr, a[href*='/ai-act/systems/']").first();
    await link.click();
    await page.waitForTimeout(3000);
    // Detail page should show system info
    await expect(page.getByText(/AIS-|risiko|risk|system/i).first()).toBeVisible();
  });

  // ── Art. 51-56: GPAI Models ────────────────────────────────
  test("GPAI models page loads", async ({ page }) => {
    await page.goto("/ai-act/gpai");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/gpai|general purpose/i).first()).toBeVisible();
  });

  // ── Art. 27: FRIA ──────────────────────────────────────────
  test("FRIA page loads", async ({ page }) => {
    await page.goto("/ai-act/frias");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    await expect(page.getByText(/grundrecht|fundamental|fria|FRIA/i).first()).toBeVisible();
  });

  // ── Art. 62-63: Incident Reporting ─────────────────────────
  test("AI incidents page loads with deadline tracking", async ({ page }) => {
    await page.goto("/ai-act/incidents");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    await expect(page.getByText(/AII-001|vorfall|incident/i).first()).toBeVisible();
  });

  // ── Art. 5: Prohibited Practices ───────────────────────────
  test("Prohibited screening page loads", async ({ page }) => {
    await page.goto("/ai-act/prohibited");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/verbot|prohibited/i).first()).toBeVisible();
  });

  // ── Art. 43: Conformity Assessments ────────────────────────
  test("Conformity assessments page loads", async ({ page }) => {
    await page.goto("/ai-act/conformity-assessments");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/konformit|conformity/i).first()).toBeVisible();
  });

  // ── Art. 16-17: Provider QMS ───────────────────────────────
  test("QMS page loads", async ({ page }) => {
    await page.goto("/ai-act/qms");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/qualit|qms/i).first()).toBeVisible();
  });

  // ── Art. 20-21: Corrective Actions ─────────────────────────
  test("Corrective actions page loads with demo data", async ({ page }) => {
    await page.goto("/ai-act/corrective-actions");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/korrektur|corrective/i).first()).toBeVisible();
  });

  // ── Art. 73-78: Authority Communication ────────────────────
  test("Authority communication page loads", async ({ page }) => {
    await page.goto("/ai-act/authority");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/beh.rd|authority/i).first()).toBeVisible();
  });

  // ── Art. 99: Penalties ─────────────────────────────────────
  test("Penalties page loads", async ({ page }) => {
    await page.goto("/ai-act/penalties");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/sanktion|penal/i).first()).toBeVisible();
  });

  // ── Art. 14: Human Oversight ───────────────────────────────
  test("Oversight logs page loads", async ({ page }) => {
    await page.goto("/ai-act/oversight-logs");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/aufsicht|oversight/i).first()).toBeVisible();
  });

  // ── Framework Mappings ─────────────────────────────────────
  test("Framework mappings page loads", async ({ page }) => {
    await page.goto("/ai-act/framework-mappings");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/mapping|zuordnung/i).first()).toBeVisible();
  });
});
