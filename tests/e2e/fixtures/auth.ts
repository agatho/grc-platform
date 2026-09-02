import { expect, type Page } from "@playwright/test";

// [ARCTOS-FULL-2026-08-31 / WP11 · S11-08, S11-07, S11-15]
//
// S11-08: `login()` used to fill the form, click, then
//   `await page.waitForLoadState("networkidle").catch(() => {})`
//   followed by `waitForTimeout(1000)`.
// Every failure mode was swallowed: wrong credentials, a 500 on /login, a
// rate-limit lockout, a hydration error. The specs then ran unauthenticated,
// their first `test.skip(!id, ...)` matched because no data came back, and
// 15 specs reported "skipped" instead of "failed". A login that does not work
// is the single most important thing an E2E suite can tell you, and this
// fixture hid it.
//
// `login()` now asserts that a session actually exists afterwards and throws a
// named error otherwise. It also waits for a state change instead of sleeping
// (S11-15).

const EMAIL = process.env.E2E_EMAIL ?? "admin@arctos.dev";
const PASSWORD = process.env.E2E_PASSWORD;

/**
 * [E2E-TRIAGE-2026-09-02] Optional tenant pin.
 *
 * Which organisation a session lands in is `roles[0].orgId`
 * (packages/auth/src/config.ts) — the first membership row the database
 * returns. Two things follow for this suite:
 *
 *   * an account with several memberships lands somewhere unpredictable, and
 *   * `f-02-org-create` CREATES an organisation and takes an admin role on it,
 *     so from that spec onwards (and on every later run, because the
 *     membership persists) the suite could be pointed at an empty throwaway
 *     tenant and every "loads with demo data" spec fails for that reason
 *     alone. This is what happened on the first full run.
 *
 * `E2E_ORG_ID` pins the tenant the suite asserts against — normally the one
 * `db:seed:demo` populates. It is opt-in: unset, behaviour is exactly as
 * before. When it IS set, a failed switch is a hard error rather than a
 * silently wrong tenant.
 */
const ORG_ID = process.env.E2E_ORG_ID;

export interface Session {
  userId?: string;
  email?: string;
  currentOrgId?: string | null;
  roles: string[];
}

/**
 * Performs a fresh login and FAILS the test if it did not work.
 *
 * Returns the session so specs can derive role-dependent expectations instead
 * of accepting "success or refusal" in one assertion (S11-07).
 */
export async function login(page: Page): Promise<Session> {
  if (!PASSWORD) {
    throw new Error(
      "E2E_PASSWORD is not set. The default admin password was removed in " +
        "WP3 (S02-01), so there is no safe fallback any more — the E2E run " +
        "must be given the seeded credentials via E2E_EMAIL / E2E_PASSWORD.",
    );
  }

  await page.goto("/login");
  await page.waitForSelector('input[type="email"], input[name="email"]', {
    timeout: 30_000,
  });

  await page
    .locator('input[type="email"], input[name="email"]')
    .first()
    .fill(EMAIL);
  await page
    .locator('input[type="password"], input[name="password"]')
    .first()
    .fill(PASSWORD);

  const submit = page.locator('button[type="submit"]').first();
  await Promise.all([
    // Deterministic wait on the login POST instead of a fixed sleep.
    page
      .waitForResponse(
        (r) =>
          r.url().includes("/api/auth/") && r.request().method() === "POST",
        { timeout: 30_000 },
      )
      .catch(() => undefined),
    submit.click(),
  ]);

  // The redirect target differs per role; wait for *any* page that is not the
  // login screen and then verify the session itself.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 60_000,
  });

  const session = await getSession(page);
  if (!session.userId) {
    const visibleError = await page
      .locator('[role="alert"], .text-red-500, .text-destructive')
      .first()
      .textContent()
      .catch(() => null);
    throw new Error(
      `login() failed for ${EMAIL}: /api/auth/session returned no user. ` +
        `Current URL: ${page.url()}. ` +
        `Page error text: ${visibleError ?? "(none)"}. ` +
        "This used to be swallowed and turned 15 specs into silent skips (S11-08).",
    );
  }

  if (ORG_ID && session.currentOrgId !== ORG_ID) {
    const status = await switchOrg(page, ORG_ID);
    if (status !== 200) {
      throw new Error(
        `E2E_ORG_ID=${ORG_ID} is set, but switching ${EMAIL} into that ` +
          `organisation answered ${status}. Either the account has no role ` +
          `there or the id is wrong — refusing to run the suite against an ` +
          `unknown tenant.`,
      );
    }
    return await getSession(page);
  }
  return session;
}

/** Returns the current session payload — useful for derived assertions. */
export async function getSession(page: Page): Promise<Session> {
  const raw = await page.evaluate(async () => {
    const r = await fetch("/api/auth/session");
    if (!r.ok) return null;
    return await r.json();
  });
  if (!raw || !raw.user) return { roles: [] };
  return {
    userId: raw.user.id,
    email: raw.user.email,
    currentOrgId: raw.user.currentOrgId,
    roles: Array.isArray(raw.user.roles)
      ? raw.user.roles.map((r: unknown) =>
          typeof r === "string"
            ? r
            : ((r as { role?: string }).role ?? String(r)),
        )
      : [],
  };
}

/**
 * [ARCTOS-FULL-2026-08-31 / WP11 · S11-15] Waits until the session actually
 * carries at least `minRoles` roles.
 *
 * Two specs used `page.waitForTimeout(1500)` after creating an organisation,
 * guessing how long the JWT needs to pick up the new role. On a slow machine
 * the guess is too short and the spec fails for a reason unrelated to the
 * product; on a fast one it wastes the difference. This waits for the state.
 */
export async function awaitSessionRoles(
  page: Page,
  minRoles: number,
  timeout = 30_000,
): Promise<void> {
  await page.waitForFunction(
    async (min) => {
      const r = await fetch("/api/auth/session");
      if (!r.ok) return false;
      const json = await r.json();
      return (json?.user?.roles?.length ?? 0) >= min;
    },
    minRoles,
    { timeout },
  );
}

/**
 * Switch to a specific org by id via the switch-org API.
 *
 * [ARCTOS-FULL-2026-08-31 / WP11] The body used to be
 * `JSON.stringify({ orgId })` INSIDE `page.evaluate`, referring to the
 * Node-side parameter instead of the `id` argument that is actually passed
 * into the browser context — a `ReferenceError` in the page. The only caller
 * accepted `[200, 403, 404]` (S11-07), so the broken helper never surfaced.
 */
export async function switchOrg(page: Page, orgId: string): Promise<number> {
  return await page.evaluate(async (id: string) => {
    const r = await fetch("/api/v1/auth/switch-org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: id }),
    });
    return r.status;
  }, orgId);
}

/** Status of an API call carrying the current session cookie. */
export async function apiStatus(
  page: Page,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<number> {
  const method = init?.method ?? "GET";
  const body = init?.body === undefined ? null : JSON.stringify(init.body);
  return await page.evaluate(
    async ([p, m, b]: [string, string, string | null]) => {
      const r = await fetch(p, {
        method: m,
        ...(b !== null
          ? { headers: { "Content-Type": "application/json" }, body: b }
          : {}),
      });
      return r.status;
    },
    [path, method, body] as [string, string, string | null],
  );
}

/**
 * Status of the same call WITHOUT the session cookie.
 * `credentials: "omit"` is what makes it anonymous.
 */
export async function anonApiStatus(page: Page, path: string): Promise<number> {
  return await page.evaluate(async (p: string) => {
    const r = await fetch(p, { credentials: "omit" });
    return r.status;
  }, path);
}

/**
 * [S11-07] Asserts an RBAC outcome EXACTLY, derived from the roles the session
 * actually carries — instead of `expect([200, 403]).toContain(status)`, which
 * passes whether the guard works or not.
 */
export function expectRbac(
  status: number,
  session: Session,
  allowedRoles: readonly string[],
  label: string,
): void {
  const permitted = session.roles.some((r) => allowedRoles.includes(r));
  if (permitted) {
    expect(
      [200, 204],
      `${label}: session has ${JSON.stringify(session.roles)} which includes ` +
        `one of ${JSON.stringify(allowedRoles)} — expected the request to be ` +
        `served, got ${status}`,
    ).toContain(status);
  } else {
    expect(
      status,
      `${label}: session has ${JSON.stringify(session.roles)} — none of ` +
        `${JSON.stringify(allowedRoles)} — expected 403, got ${status}`,
    ).toBe(403);
  }
}

/**
 * [S11-07] A read endpoint that exists must answer 200 or 204 for an
 * authorised session. 404 is a routing defect, not an acceptable outcome, and
 * must not share an assertion with the success case.
 */
export function expectServed(status: number, label: string): void {
  expect(
    [200, 204],
    `${label}: expected the endpoint to answer 200/204 for an authenticated ` +
      `session, got ${status}. A 404 here means the route does not exist ` +
      `(defect), not "no data" — an empty list is still a 200.`,
  ).toContain(status);
}
