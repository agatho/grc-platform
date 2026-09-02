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

  return await loginAs(page, EMAIL, PASSWORD);
}

/**
 * [E2E-TRIAGE-3 · 2026-09-02] The same login, for a NAMED account.
 *
 * `login()` could only ever sign in `E2E_EMAIL`, which is why every spec that
 * needed somebody else — `f-02b` asserts that an ORG admin (not a platform
 * admin) is refused a top-level tenant — had to assert around the single
 * account the suite had. The role accounts are provisioned by
 * `npm run db:seed:e2e-users`; see `apps/web/e2e/fixtures/storage.ts`.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string | undefined,
): Promise<Session> {
  if (!password) {
    throw new Error(
      `no password available for ${email}. Role accounts are provisioned by ` +
        "`E2E_ROLE_PASSWORD='<12+ chars>' npm run db:seed:e2e-users`; the " +
        "run needs the same E2E_ROLE_PASSWORD exported.",
    );
  }

  // [E2E-TRIAGE-3] Reuse an existing session rather than signing in again.
  //
  // The regression project performed one FRESH login per spec — 46 of them
  // from a single address — while the login surface is capped by
  // RATE_LIMIT_AUTH (10/min per address, fail-closed, WP9/S10-05). The suite
  // therefore could not pass unless the operator remembered to raise a
  // SERVER-side limit first. The project now carries the storage state the
  // setup project wrote (playwright.config.ts), so this finds a session and
  // uses the form only when there is none, or when a spec asks for a
  // different account than the one in the state. The limiter is untouched —
  // the suite simply stopped hammering it.
  await page.goto("/dashboard").catch(() => undefined);
  // One retry: a single hiccup on /api/auth/session (it re-reads the roles
  // from the database on every call, apps/web/src/auth.ts) would otherwise
  // send a spec that HAS a valid session down the form path, and the form path
  // is both slower and, under a loaded suite, racier.
  let existing = await getSession(page);
  if (!existing.userId) {
    await page.waitForTimeout(500);
    existing = await getSession(page);
  }
  if (
    existing.userId &&
    existing.email?.toLowerCase() === email.toLowerCase()
  ) {
    if (ORG_ID && existing.currentOrgId !== ORG_ID) {
      const status = await switchOrg(page, ORG_ID);
      if (status !== 200) {
        throw new Error(
          `E2E_ORG_ID=${ORG_ID} is set, but switching ${email} into that ` +
            `organisation answered ${status} — refusing to run the suite ` +
            "against an unknown tenant.",
        );
      }
      return await getSession(page);
    }
    return existing;
  }

  // A session for SOMEBODY ELSE is in the way: /login would redirect straight
  // back to the dashboard and the form would never appear. Drop it first.
  if (existing.userId) {
    await page.context().clearCookies();
  }

  await page.goto("/login");
  const emailInput = page
    .locator('input[type="email"], input[name="email"]')
    .first();
  const passwordInput = page
    .locator('input[type="password"], input[name="password"]')
    .first();
  await emailInput.waitFor({ state: "visible", timeout: 30_000 });

  // [E2E-TRIAGE-3 · 2026-09-02] Fill, then CHECK, then submit.
  //
  // `waitForSelector` resolves as soon as the input exists in the
  // server-rendered markup. React then hydrates and resets its controlled
  // inputs to their initial state, discarding whatever was typed in between.
  // Two failures of the full run landed exactly there: the page snapshot shows
  // the password filled and the e-mail field EMPTY, the form never submitted,
  // and `access_log` holds no login attempt at all for that moment — so the
  // run reported "Timeout on waitForURL" for something the server never saw.
  // Verify the fields actually hold what we typed before clicking.
  for (let attempt = 1; attempt <= 3; attempt++) {
    await emailInput.fill(email);
    await passwordInput.fill(password);
    if (
      (await emailInput.inputValue()) === email &&
      (await passwordInput.inputValue()) === password
    ) {
      break;
    }
    if (attempt === 3) {
      throw new Error(
        `the login form kept discarding its input for ${email} — the page ` +
          "appears to re-hydrate after every fill. e-mail field held " +
          `'${await emailInput.inputValue()}'.`,
      );
    }
    await page.waitForTimeout(300);
  }

  const submit = page.locator('button[type="submit"]').first();
  const [loginResponse] = await Promise.all([
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

  // [E2E-TRIAGE-2026-09-02] Name a rate-limited login instead of timing out on
  // it. When the login POST is answered with 429 the form never navigates, so
  // the `waitForURL` below can only expire — and the failure then reads
  // "page.waitForURL: Timeout 60000ms exceeded", which points at the product
  // rather than at the limiter. Three specs of the second full run failed in
  // exactly that shape. The login surface is deliberately capped by
  // `RATE_LIMIT_AUTH` (default 10/min, address-keyed, fail-closed —
  // WP9/S10-05) and this suite performs one fresh login per regression spec
  // from a single address, so the cap is reached partway through the run.
  // That is the limiter working; the run has to say so.
  if (loginResponse?.status() === 429) {
    throw new Error(
      `login() for ${email} was refused with 429 (rate limited). The login ` +
        `surface is capped by RATE_LIMIT_AUTH — default 10 per minute per ` +
        `client address, fail-closed — and this suite logs in once per ` +
        `regression spec from one address. Since E2E-TRIAGE-3 the project ` +
        `carries the setup's storage state, so this path is only reached for ` +
        `an account that is NOT in that state — check the role accounts ` +
        `exist (npm run db:seed:e2e-users), or raise the limit for the E2E ` +
        `environment (RATE_LIMIT_AUTH=1000/60, a SERVER-side variable). This ` +
        `is the limiter doing its job, not a product defect.`,
    );
  }

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
      `login() failed for ${email}: /api/auth/session returned no user. ` +
        `Current URL: ${page.url()}. ` +
        `Page error text: ${visibleError ?? "(none)"}. ` +
        "This used to be swallowed and turned 15 specs into silent skips (S11-08).",
    );
  }

  if (ORG_ID && session.currentOrgId !== ORG_ID) {
    const status = await switchOrg(page, ORG_ID);
    if (status !== 200) {
      throw new Error(
        `E2E_ORG_ID=${ORG_ID} is set, but switching ${email} into that ` +
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
