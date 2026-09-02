import { test as setup, expect, type Page } from "@playwright/test";
import {
  ROLE_ACCOUNTS,
  ROLE_ACCOUNTS_CONFIGURED,
  STORAGE_STATE,
  type RoleAccount,
} from "./fixtures/storage";

/**
 * [ARCTOS-FULL-2026-08-31 / WP11 · S11-06, S11-08]
 *
 * Two changes:
 *
 *  * The credentials were hard-coded as `admin@arctos.dev` / `admin123`.
 *    WP3 removed that default account and password from the seed and from
 *    `deploy/setup.sh` (S02-01), so the literal is now guaranteed to be wrong
 *    on any freshly provisioned environment. The run has to be given real
 *    credentials, and it has to say so instead of failing on a selector.
 *
 *  * The storage-state path was a cwd-relative string; it now resolves from
 *    this file's own location, so the root config can run all 67 specs from
 *    the repository root (see playwright.config.ts).
 *
 * [E2E-TRIAGE-3 · 2026-09-02] The single login became four.
 *
 * One account cannot test separation of duties. `authenticate as <role>` below
 * signs in the three role accounts `db:seed:e2e-users` provisions and writes
 * one storage state per role, so a spec can name the actor it means instead of
 * stopping where a second person would be needed.
 */

const EMAIL = process.env.E2E_EMAIL ?? "admin@arctos.dev";
const PASSWORD = process.env.E2E_PASSWORD;

/**
 * Signs `email` in on `page` and returns the session user.
 *
 * Everything the original setup asserted is asserted here for every account:
 * a redirect away from /login is not proof, so the session endpoint has to
 * carry a user id before any storage state is written (S11-08).
 */
async function signIn(
  page: Page,
  email: string,
  password: string,
): Promise<{ id?: string; currentOrgId?: string }> {
  await page.goto("/login");

  // Wait for the form to be visible (client-side hydration)
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  await emailInput.waitFor({ state: "visible", timeout: 30000 });

  // [E2E-TRIAGE-3 · 2026-09-02] Fill, then CHECK, then submit — the selector
  // resolves on the server-rendered markup and React discards controlled-input
  // values when it hydrates afterwards. Two failures of the full run were
  // exactly that: password filled, e-mail field empty, no login attempt in
  // `access_log`, reported as a navigation timeout. Same guard as
  // tests/e2e/fixtures/auth.ts.
  for (let attempt = 1; attempt <= 3; attempt++) {
    // Fill using CSS selectors (more reliable than getByLabel with i18n)
    await emailInput.fill(email);
    await passwordInput.fill(password);
    if (
      (await emailInput.inputValue()) === email &&
      (await passwordInput.inputValue()) === password
    ) {
      break;
    }
    expect(
      attempt,
      `the login form kept discarding its input for ${email}`,
    ).toBeLessThan(3);
    await page.waitForTimeout(300);
  }
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to dashboard (first compile can be slow)
  await expect(page).toHaveURL(/dashboard/, { timeout: 60000 });

  const session = await page.evaluate(async () => {
    const r = await fetch("/api/auth/session");
    return r.ok ? await r.json() : null;
  });
  expect(
    session?.user?.id,
    `login as ${email} produced no session — refusing to write an empty ` +
      "storage state.",
  ).toBeTruthy();
  return session.user as { id?: string; currentOrgId?: string };
}

setup("authenticate as admin", async ({ page }) => {
  expect(
    PASSWORD,
    "E2E_PASSWORD is not set. WP3 removed the `admin123` default account " +
      "(S02-01), so there is no credential to fall back on — export " +
      "E2E_EMAIL / E2E_PASSWORD for the seeded account before running the " +
      "E2E suite.",
  ).toBeTruthy();

  const user = await signIn(page, EMAIL, PASSWORD!);

  // [E2E-TRIAGE-2026-09-02] Pin the tenant into the stored state.
  //
  // The active organisation of a session is the `arctos-org-id` cookie or,
  // when that cookie does not arrive, `roles[0].orgId`
  // (packages/auth/src/context.ts). An account with several memberships
  // therefore lands somewhere unpredictable, and `f-02-org-create` adds a
  // THROWAWAY organisation to that set on every run, permanently. On the first
  // full run the whole suite ended up pointed at an empty `E2E-F02b-…` tenant
  // and every "loads with demo data" spec failed for that reason alone.
  //
  // `E2E_ORG_ID` names the tenant the suite asserts against — the one
  // `db:seed:demo` populates; `playwright.config.ts` supplies the default so
  // the value does not have to live in the operator's memory.
  //
  // Measured in this round and worth stating: that cookie is issued with
  // `Secure`, so against a plain-http target it reaches the browser context
  // but NOT Playwright's `request` fixture — API-first specs on this state
  // fall back to `roles[0].orgId`. That is precisely why the ROLE accounts
  // below hold exactly ONE membership: for them both paths resolve to the same
  // tenant by construction. See packages/db/src/seed-e2e-users.ts.
  const orgId = process.env.E2E_ORG_ID;
  if (orgId && user?.currentOrgId !== orgId) {
    const status = await page.evaluate(async (id: string) => {
      const r = await fetch("/api/v1/auth/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: id }),
      });
      return r.status;
    }, orgId);
    expect(
      status,
      `E2E_ORG_ID=${orgId} is set, but switching ${EMAIL} into that ` +
        `organisation answered ${status}. Refusing to write a storage state ` +
        "for an unknown tenant.",
    ).toBe(200);
  }

  // Save auth state
  await page.context().storageState({ path: STORAGE_STATE });
});

/**
 * One setup test per role account. They FAIL — they never skip — when the
 * accounts are missing: a separation-of-duties test that quietly does not run
 * is worth less than no test at all (S11-07, S11-08).
 */
for (const account of ROLE_ACCOUNTS as readonly RoleAccount[]) {
  setup(`authenticate as ${account.key}`, async ({ page }) => {
    expect(
      ROLE_ACCOUNTS_CONFIGURED,
      "E2E_ROLE_PASSWORD is not set. The suite needs more than one account " +
        "to exercise separation of duties (bpm-approval-pipeline, f-02b). " +
        "Provision them with\n" +
        "  E2E_ROLE_PASSWORD='<12+ chars>' npm run db:seed:e2e-users\n" +
        "and export the same value for the run.",
    ).toBe(true);

    const user = await signIn(page, account.email, account.password!);
    expect(
      user?.currentOrgId,
      `${account.email} has no active organisation. The account is expected ` +
        "to hold exactly one membership — re-run `npm run db:seed:e2e-users`.",
    ).toBeTruthy();

    // A role account with the wrong roles would otherwise fail much later,
    // inside an approval chain, as a confusing 403. Check it here.
    const roles: string[] = await page.evaluate(async () => {
      const r = await fetch("/api/auth/session");
      const j = r.ok ? await r.json() : null;
      return (j?.user?.roles ?? []).map((x: unknown) =>
        typeof x === "string" ? x : ((x as { role?: string }).role ?? ""),
      );
    });
    for (const expected of account.roles) {
      expect(
        roles,
        `${account.email} is missing the '${expected}' role in its ` +
          `organisation (has: ${JSON.stringify(roles)}). Re-run ` +
          "`npm run db:seed:e2e-users`.",
      ).toContain(expected);
    }

    await page.context().storageState({ path: account.storageState });
  });
}
