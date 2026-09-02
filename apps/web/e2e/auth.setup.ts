import { test as setup, expect, type Page } from "@playwright/test";
import {
  PRIMARY_ACCOUNT,
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
 *
 * [E2E-TRIAGE-4 · 2026-09-02] The primary login is seeded like the others, and
 * the tenant is now ASSERTED instead of repaired.
 *
 * This setup used to switch the primary account into `E2E_ORG_ID` when its
 * session had landed somewhere else. That repair only ever reached half the
 * suite: `switch-org` sets the `arctos-org-id` cookie, the cookie carries
 * `Secure`, and over a plain-http target a `Secure` cookie reaches the browser
 * context but not Playwright's `request` fixture — so the API-first specs kept
 * running in `roles[0].orgId`, measurably an empty tenant. The account is
 * provisioned with exactly one membership now (see
 * `packages/db/src/seed-e2e-users.ts`), which makes both paths resolve to the
 * same organisation; what remains here is the check that this is actually so.
 */

const EMAIL = PRIMARY_ACCOUNT.email;
const PASSWORD = PRIMARY_ACCOUNT.password;

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
    "No password for the primary E2E account. Provision it with\n" +
      "  E2E_ROLE_PASSWORD='<12+ chars>' npm run db:seed:e2e-users\n" +
      "and export the same value (or E2E_PASSWORD) for the run. WP3 removed " +
      "the `admin123` default account (S02-01), so there is nothing to fall " +
      "back on.",
  ).toBeTruthy();

  const user = await signIn(page, EMAIL, PASSWORD!);

  // [E2E-TRIAGE-4 · 2026-09-02] Assert the tenant; do not repair it.
  //
  // `currentOrgId` on a freshly signed-in session is `roles[0].orgId` — no
  // `arctos-org-id` cookie has been set yet — and that is precisely the value
  // every request WITHOUT that cookie resolves to, including Playwright's
  // `request` fixture, which never receives it because the cookie is `Secure`
  // and the target is plain http. So this one comparison covers both halves of
  // the suite, which the previous `switch-org` repair did not: it moved the
  // browser into `E2E_ORG_ID` and left the API-first specs in `roles[0]`,
  // measurably an organisation with zero assets.
  //
  // A mismatch is a seeding problem with one fix, so the message names it.
  const orgId = process.env.E2E_ORG_ID;
  if (orgId) {
    expect(
      user?.currentOrgId,
      `${EMAIL} resolves to organisation ${user?.currentOrgId}, but the ` +
        `suite asserts against ${orgId}. The primary account must hold its ` +
        "OLDEST membership in that tenant — anything else splits the run " +
        "across two tenants, because the org cookie does not reach the API " +
        "fixture over http. Fix it where it is reproducible:\n" +
        `  E2E_EMAIL=${EMAIL} E2E_ROLE_PASSWORD='<12+ chars>' ` +
        "npm run db:seed:e2e-users",
    ).toBe(orgId);
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
    // [E2E-TRIAGE-4] Same check as for the primary account: the role accounts
    // and the primary one must sign in to the SAME tenant, or a spec that
    // hands work from one to the other (bpm-approval-pipeline,
    // document-signature) fails as a 404 that looks like a product defect.
    const expectedOrgId = process.env.E2E_ORG_ID;
    if (expectedOrgId) {
      expect(
        user?.currentOrgId,
        `${account.email} resolves to ${user?.currentOrgId}, the suite ` +
          `asserts against ${expectedOrgId}. Re-run ` +
          "`npm run db:seed:e2e-users` with the same E2E_ORG_ID.",
      ).toBe(expectedOrgId);
    }

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
