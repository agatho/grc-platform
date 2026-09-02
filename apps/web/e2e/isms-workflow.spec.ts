/**
 * ISMS ISO 27001/27005 End-to-End Workflow Test
 * Tests the complete information security risk management lifecycle:
 * Asset → Threat → Vulnerability → Risk Scenario → Treatment → SoA → Review
 */
import { test, expect } from "@playwright/test";
import { awaitAppReady } from "./fixtures/wait";
import { STORAGE_STATE } from "./fixtures/storage";

// [E2E-TRIAGE-2026-09-02] `await page.waitForLoadState("networkidle")` replaced
// by `awaitAppReady(page)` throughout this file.
//
// The bare call has no timeout of its own, so it waits until the TEST times out
// — 90 s. Measured on the re-run after the demo data was seeded: /esg, /audit,
// /dpms and /contracts never reach "networkidle" (a widget polls), and four
// specs that had passed turned into 90-second hangs whose message names
// `waitForLoadState`, not the assertion that matters. Playwright deprecates
// `networkidle` for exactly this reason.
//
// `awaitAppReady` (e2e/fixtures/wait.ts) is the helper the audit introduced for
// this: it waits for `domcontentloaded`, then gives the network 15 s to go
// quiet and CONTINUES either way. Nothing is weakened — the assertion after it
// is the real check and retries on its own for `expect.timeout`.

test.describe("ISMS ISO 27001 Workflow", () => {
  test.use({ storageState: STORAGE_STATE });

  // ── Phase 1: ISMS Dashboard ──────────────────────────────
  test("S1.1: ISMS dashboard shows KPIs", async ({ page }) => {
    await page.goto("/isms");
    await awaitAppReady(page);
    await expect(page.getByText(/isms/i).first()).toBeVisible();
    await expect(page.getByText(/compliance.*score/i).first()).toBeVisible();
  });

  // ── Phase 2: Asset Management ─────────────────────────────
  test("S1.2: Asset list loads with classification", async ({ page }) => {
    await page.goto("/isms/assets");
    await awaitAppReady(page);
    await expect(page.getByText(/asset/i).first()).toBeVisible();
    // Should show at least one asset
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("S1.2: Asset detail page loads", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/isms/assets");
    await awaitAppReady(page);
    // Click first asset row or link
    const link = page.locator("table tbody tr a, table tbody tr").first();
    await link.click();
    await awaitAppReady(page);
    // Should show asset details
    await expect(
      page
        .getByText(/klassifizierung|classification|asset|schutzbedarf/i)
        .first(),
    ).toBeVisible();
  });

  // ── Phase 3: Threats & Vulnerabilities ────────────────────
  test("S2.2: Threats page loads", async ({ page }) => {
    await page.goto("/isms/threats");
    await awaitAppReady(page);
    await expect(page.getByText(/bedrohung|threat/i).first()).toBeVisible();
  });

  test("S2.3: Vulnerabilities page loads", async ({ page }) => {
    await page.goto("/isms/vulnerabilities");
    await awaitAppReady(page);
    await expect(
      page.getByText(/schwachstell|vulnerabilit/i).first(),
    ).toBeVisible();
  });

  // ── Phase 4: Risk Scenarios ───────────────────────────────
  test("S2.4: IS Risk scenarios page loads with data", async ({ page }) => {
    await page.goto("/isms/risks");
    await awaitAppReady(page);
    await expect(
      page.getByText(/risikoszenar|risk scenario|risiken|IS-Risik/i).first(),
    ).toBeVisible();
  });

  test("S2.5: Risk scenario detail page loads", async ({ page }) => {
    await page.goto("/isms/risks");
    await awaitAppReady(page);
    await page.locator("table tbody tr").first().click();
    await awaitAppReady(page);
    // Should show risk details
    await expect(page.getByText(/bedrohung|threat/i).first()).toBeVisible();
    await expect(page.getByText(/behandlung|treatment/i).first()).toBeVisible();
  });

  // ── Phase 5: SoA ──────────────────────────────────────────
  //
  // [E2E-TRIAGE-3 · 2026-09-02] This was NOT a locator problem.
  //
  // Round 2 recorded "the text is in the HTML, the locator does not find it"
  // and left it unclassified. Measured: the only occurrence of "Kontrollen" in
  // the document was a `title=` attribute on a sidebar link — an attribute is
  // not text, so `getByText` correctly matched nothing. The page itself was
  // showing "Keine SoA-Einträge gefunden" over a tenant whose SoA the API
  // returns without complaint, because `fetchData` asked for `limit=200`,
  // `paginate()` rejects anything above 100 with 422 (#NIGHT-059), and the
  // page discarded that status with a bare `if (res.ok)`. The stats bar — the
  // element that carries the word this test looks for — renders only when
  // `stats` is set, so the assertion was reporting the empty page accurately.
  //
  // The page is fixed (it pages at the size the API allows and shows a failed
  // load as a failure). The assertion is sharpened at the same time: a test
  // named "loads with Annex A controls" should fail when the SoA is empty, not
  // pass on the word "Kontrollen" appearing anywhere.
  test("S3.1: SoA page loads with Annex A controls", async ({ page }) => {
    await page.goto("/isms/soa");
    await awaitAppReady(page);
    await expect(
      page.getByText(/anwendbarkeit|applicability/i).first(),
    ).toBeVisible();
    // The stats bar only exists when the list actually loaded.
    await expect(page.getByText(/kontrollen|controls/i).first()).toBeVisible();
    // A failed load must not be mistaken for an empty SoA, and an empty SoA
    // must not be mistaken for a loaded one.
    await expect(
      page.getByText(/keine soa-einträge|no soa entries/i),
      "the SoA page shows its empty state for a tenant that has SoA entries",
    ).toHaveCount(0);
    await expect(
      page.locator('[role="alert"]').filter({ hasText: /nicht geladen/i }),
      "the SoA list could not be loaded",
    ).toHaveCount(0);
    // Entries, not just chrome.
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  // ── Phase 6: Assessments & Maturity ───────────────────────
  test("S2.4: Assessments page loads", async ({ page }) => {
    await page.goto("/isms/assessments");
    await awaitAppReady(page);
    await expect(page.getByText(/bewertung|assessment/i).first()).toBeVisible();
  });

  test("S4.1: Maturity page loads", async ({ page }) => {
    await page.goto("/isms/maturity");
    await awaitAppReady(page);
    await expect(page.getByText(/reifegrad|maturity/i).first()).toBeVisible();
  });

  // ── Phase 7: Incidents ────────────────────────────────────
  test("S4.3: Incidents page loads with demo data", async ({ page }) => {
    await page.goto("/isms/incidents");
    await awaitAppReady(page);
    await expect(page.getByText(/vorfall|incident/i).first()).toBeVisible();
    // Should show at least 1 incident
    await expect(page.getByText(/INC/i).first()).toBeVisible();
  });

  // ── Phase 8: CAP ──────────────────────────────────────────
  test("S6.1: CAP page loads with nonconformities", async ({ page }) => {
    await page.goto("/isms/cap");
    await awaitAppReady(page);
    await expect(
      page
        .getByText(/korrekturma|corrective|nichtkonform|nonconform|CAP/i)
        .first(),
    ).toBeVisible();
  });

  // ── Phase 9: Management Review ────────────────────────────
  test("S5.2: Management review page loads", async ({ page }) => {
    await page.goto("/isms/reviews");
    await awaitAppReady(page);
    await expect(page.getByText(/management.*review/i).first()).toBeVisible();
  });

  // ── Phase 10: Certifications ──────────────────────────────
  test("S5.3: Certifications page loads", async ({ page }) => {
    await page.goto("/isms/certifications");
    await awaitAppReady(page);
    await expect(
      page.getByText(/zertifizierung|certification/i).first(),
    ).toBeVisible();
  });

  // ── Tab Navigation ────────────────────────────────────────
  test("horizontal tab navigation works", async ({ page }) => {
    await page.goto("/isms");
    await awaitAppReady(page);
    // Tab bar should be visible
    const tabNav = page.locator('[aria-label="Modul-Navigation"]');
    await expect(tabNav).toBeVisible();
    // Click on Assets tab
    await tabNav.getByText(/assets/i).click();
    await expect(page).toHaveURL(/\/isms\/assets/);
  });
});
