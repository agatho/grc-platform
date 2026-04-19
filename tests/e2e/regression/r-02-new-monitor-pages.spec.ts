import { test, expect } from "@playwright/test";
import { login } from "../fixtures/auth";

// R-02: Smoke test for the 11 new monitor/composite pages introduced in the
// Sprint 5.3-5.7 + Epic 6 + UI block + monitor-matrix work. Each page should
// render without 500s, without the "konnte nicht geladen werden" error card,
// and load its primary API within 15s.

const PAGES: Array<{ name: string; path: string; expectedText: string }> = [
  {
    name: "GRC Composite Dashboard",
    path: "/grc-composite",
    expectedText: "Overall GRC Health",
  },
  {
    name: "Cross-Module Findings",
    path: "/grc-findings",
    expectedText: "Cross-Module Findings",
  },
  {
    name: "Cross-Module Risk Sync",
    path: "/grc-risk-sync",
    expectedText: "Cross-Module Risk Sync",
  },
  {
    name: "AI-Act Annual Report (current year)",
    path: "/ai-act/annual-report",
    expectedText: "Overall Compliance Score",
  },
  {
    name: "AI-Act Incidents Monitor",
    path: "/ai-act/incidents/monitor",
    expectedText: "Incidents Monitor",
  },
  {
    name: "DPMS Deadline Monitor",
    path: "/dpms/deadline-monitor",
    expectedText: "DPMS Deadline Monitor",
  },
  {
    name: "BCMS Readiness Monitor",
    path: "/bcms/readiness-monitor",
    expectedText: "BCMS Readiness Monitor",
  },
  {
    name: "ISMS CAP Monitor",
    path: "/isms/cap-monitor",
    expectedText: "ISMS CAP Monitor",
  },
];

test.describe("R-02: New monitor + composite pages smoke", () => {
  for (const { name, path, expectedText } of PAGES) {
    test(`R-02 ${name}: ${path} renders without errors`, async ({ page }) => {
      await login(page);

      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(resp?.status()).toBeLessThan(500);

      // Wait for the primary heading text to appear (indicates client-side fetch
      // + render completed).
      await expect(page.getByText(expectedText).first()).toBeVisible({
        timeout: 15_000,
      });

      // No error card should be visible.
      const errorCard = page.getByText("konnte nicht geladen werden");
      await expect(errorCard).not.toBeVisible();
    });
  }
});
