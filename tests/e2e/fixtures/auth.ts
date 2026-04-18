import type { Page } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "admin@arctos.dev";
const PASSWORD = process.env.E2E_PASSWORD ?? "admin123";

/** Performs a fresh login and waits for the dashboard. */
export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

/** Returns the current session payload -- useful for derived assertions. */
export async function getSession(
  page: Page,
): Promise<{
  userId?: string;
  email?: string;
  currentOrgId?: string | null;
  roleCount?: number;
}> {
  const raw = await page.evaluate(async () => {
    const r = await fetch("/api/auth/session");
    if (!r.ok) return null;
    return await r.json();
  });
  if (!raw || !raw.user) return {};
  return {
    userId: raw.user.id,
    email: raw.user.email,
    currentOrgId: raw.user.currentOrgId,
    roleCount: raw.user.roles?.length ?? 0,
  };
}

/** Switch to a specific org by id via the switch-org API. */
export async function switchOrg(page: Page, orgId: string): Promise<number> {
  return await page.evaluate(async (id) => {
    const r = await fetch("/api/v1/auth/switch-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: id }),
    });
    return r.status;
  }, orgId);
}
