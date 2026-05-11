/**
 * Accessibility smoke — runs axe-core against the pages flagged in the
 * 2026-05-11 QA verification (QA-015). The headline question that report
 * raised: do the Radix Select / Tabs wrappers have a real click handler,
 * or do they only respond to PointerEvent? If axe is clean and the
 * keyboard-driven open-dropdown sub-test passes, the answer is "yes,
 * they're wired correctly" and we can close QA-015 as not-an-issue.
 *
 * Scope kept narrow: dashboard, risk register, risk wizard. Not a full
 * a11y audit — that's a separate sprint. We only fail the build on
 * Serious or Critical impact violations to keep this test from becoming
 * a flake source as the design system evolves; Minor and Moderate
 * findings are surfaced via console + the playwright report attachment.
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ storageState: "e2e/.auth/admin.json" });

const BLOCKING_IMPACTS = ["serious", "critical"] as const;
type BlockingImpact = (typeof BLOCKING_IMPACTS)[number];

interface AxeViolation {
  id: string;
  impact: string | null;
  description: string;
  nodes: { target: string[] }[];
}

async function runAxe(page: Page, label: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const violations = result.violations as AxeViolation[];
  const blocking = violations.filter((v) =>
    BLOCKING_IMPACTS.includes(v.impact as BlockingImpact),
  );
  const advisory = violations.filter(
    (v) => !BLOCKING_IMPACTS.includes(v.impact as BlockingImpact),
  );

  if (advisory.length > 0) {
    console.log(
      `[a11y][${label}] ${advisory.length} non-blocking finding(s):`,
      advisory.map((v) => `${v.impact}/${v.id} (${v.nodes.length} node(s))`),
    );
  }

  return { blocking, advisory, violations };
}

test.describe("a11y smoke — QA-015 follow-up", () => {
  test("dashboard has no serious/critical axe violations", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const { blocking } = await runAxe(page, "dashboard");
    expect(
      blocking,
      `Serious/critical axe violations on /dashboard: ${JSON.stringify(blocking, null, 2)}`,
    ).toEqual([]);
  });

  test("risk register has no serious/critical axe violations", async ({
    page,
  }) => {
    await page.goto("/risks");
    await page.waitForLoadState("networkidle");
    const { blocking } = await runAxe(page, "risks-list");
    expect(blocking).toEqual([]);
  });

  test("risk wizard has no serious/critical axe violations", async ({
    page,
  }) => {
    await page.goto("/risks/new");
    await page.waitForLoadState("networkidle");
    const { blocking } = await runAxe(page, "risks-new");
    expect(blocking).toEqual([]);
  });

  test("Radix Select: opens via keyboard (Space) — answers QA-015", async ({
    page,
  }) => {
    // QA-015 noted that programmatic `MouseEvent.click()` against a
    // Radix combobox didn't open the listbox in their DOM-only test
    // tooling, only PointerEvent did. The accessibility question is:
    // does keyboard activation work? Screen readers and keyboard users
    // press Space/Enter on the trigger, which Radix wires to
    // pointerdown internally. If THIS works, the dropdown is reachable
    // for everyone who matters; the click()-doesn't-open finding was
    // about test-tooling, not real a11y.
    await page.goto("/risks/new");
    await page.waitForLoadState("networkidle");

    // The risk-category Select is the first Radix combobox on the wizard.
    const trigger = page.locator('[role="combobox"]').first();
    await expect(trigger).toBeVisible({ timeout: 10_000 });
    await trigger.focus();
    await page.keyboard.press("Space");

    // Listbox should now be in the DOM and visible. Radix renders it in
    // a portal so we look at the document root rather than the trigger
    // subtree.
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 5_000 });
    expect(await listbox.locator('[role="option"]').count()).toBeGreaterThan(0);
  });
});
