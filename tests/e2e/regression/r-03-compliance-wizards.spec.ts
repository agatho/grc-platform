import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// R-03: Smoke test for the parametrised compliance-wizard pages.
// Grabs the first AI system + GPAI model id via API, navigates to the wizard,
// asserts the page renders and the "run check" button triggers a POST that
// resolves without a 5xx. Complements R-02 which skipped these pages because
// they need a fixture id.

async function firstId(
  page: import("@playwright/test").Page,
  endpoint: string,
): Promise<string | null> {
  const raw = await page.evaluate(async (url) => {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: Array<{ id: string }> };
    return j.data?.[0]?.id ?? null;
  }, endpoint);
  return raw;
}

test.describe("R-03: Compliance-Wizard smoke", () => {
  test("R-03.1: AI-System compliance-wizard renders + DG check fires", async ({ page }) => {
    await login(page);

    const systemId = await firstId(page, "/api/v1/ai-act/systems?limit=1");
    test.skip(!systemId, "No AI system in tenant");

    const resp = await page.goto(`/ai-act/systems/${systemId}/compliance-wizard`);
    expect(resp?.status()).toBeLessThan(500);

    await expect(page.getByText("AI-Act Compliance Wizard")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Art. 10 Data-Governance").first()).toBeVisible();

    // Click the first "Pruefen" button (Data-Governance section).
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/ai-act/systems/${systemId}/data-governance-check`) &&
          r.request().method() === "POST",
        { timeout: 15_000 },
      ),
      page.getByRole("button", { name: /^Pruefen$/ }).first().click(),
    ]);
    expect(response.status()).toBeLessThan(500);

    // Wait for either "Pass", "Fail" or "Warnung" pill to appear -- indicates
    // the result rendered without a crash.
    await expect(
      page.getByText(/Pass|Fail|Warnung/).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("R-03.2: GPAI compliance-wizard renders + classify fires", async ({ page }) => {
    await login(page);

    const gpaiId = await firstId(page, "/api/v1/ai-act/gpai?limit=1");
    test.skip(!gpaiId, "No GPAI model in tenant");

    const resp = await page.goto(`/ai-act/gpai/${gpaiId}/compliance-wizard`);
    expect(resp?.status()).toBeLessThan(500);

    await expect(page.getByText("GPAI Compliance Wizard")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("Art. 51 Systemic-Risk Classification"),
    ).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/ai-act/gpai/${gpaiId}/classify-risk`) &&
          r.request().method() === "POST",
        { timeout: 15_000 },
      ),
      page.getByRole("button", { name: /^Klassifizieren$/ }).click(),
    ]);
    expect(response.status()).toBeLessThan(500);

    // One of the three tier badges should appear.
    await expect(
      page.getByText(/SYSTEMIC|HIGH-CAPABILITY|STANDARD/).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
