import path from "node:path";

/**
 * [ARCTOS-FULL-2026-08-31 / WP11 · S11-06]
 *
 * Absolute path to the storage state written by `auth.setup.ts`.
 *
 * The specs used the literal `"e2e/.auth/admin.json"`, which Playwright
 * resolves against `process.cwd()`. That worked only when the suite was
 * started from `apps/web/`. The repository-root config — the one that runs all
 * 67 specs together — has a different cwd, and every spec would have silently
 * started unauthenticated. One constant, resolved from this file's own
 * location, works from any working directory.
 *
 * `__dirname` rather than `import.meta.url`: Playwright transpiles specs to
 * CommonJS, where `import.meta` is a syntax error.
 */
export const STORAGE_STATE = path.resolve(__dirname, "../.auth/admin.json");

/**
 * [E2E-TRIAGE-3 · 2026-09-02] Role accounts — separation of duties.
 *
 * The suite had exactly one account, so every "a second person must approve"
 * control was untestable: `bpm-approval-pipeline` reached the last gate and
 * was refused by `canDecideApprovalStep` (WP3/S02-12), which was the control
 * working, not a product weakness. Three accounts now exist, provisioned
 * reproducibly by `npm run db:seed:e2e-users`
 * (packages/db/src/seed-e2e-users.ts) and logged in by `auth.setup.ts` into
 * one storage state each:
 *
 *   owner     process_owner                 the producing side
 *   reviewer  auditor + compliance_officer  decides the review gate
 *   approver  admin                         decides the approval gate; also
 *                                           the org-admin-but-NOT-platform-
 *                                           admin `f-02-org-create` needs
 *
 * A spec picks the actor it means with `test.use({ storageState: … })` or,
 * when one test needs several actors, with
 * `playwright.request.newContext({ storageState: … })`.
 */
export const STORAGE_STATE_OWNER = path.resolve(
  __dirname,
  "../.auth/owner.json",
);
export const STORAGE_STATE_REVIEWER = path.resolve(
  __dirname,
  "../.auth/reviewer.json",
);
export const STORAGE_STATE_APPROVER = path.resolve(
  __dirname,
  "../.auth/approver.json",
);

/**
 * The role accounts as the setup project logs them in. Kept next to the paths
 * so no spec has to restate an address or guess an environment variable name;
 * the defaults are exactly the ones `seed-e2e-users.ts` writes.
 */
export interface RoleAccount {
  key: "owner" | "reviewer" | "approver";
  email: string;
  password: string | undefined;
  storageState: string;
  /** The roles the seed grants this account. */
  roles: readonly string[];
}

const ROLE_PASSWORD = process.env.E2E_ROLE_PASSWORD;

/**
 * [E2E-TRIAGE-4 · 2026-09-02] The PRIMARY account, from the same source.
 *
 * `admin@arctos.dev` used to be the default here and in
 * `tests/e2e/fixtures/auth.ts`. That account is created by `db:seed` with
 * `must_change_password = true` and a password nothing outside the operator's
 * terminal knows, so the default could only ever fail — while the account that
 * actually ran the suite (`admin@arctos.local` on the reference machine) was
 * created by `db:create-admin`, i.e. by no seed at all. A fresh database could
 * not reproduce the run, and that account's twenty memberships put the
 * browser half of the suite in one tenant and the API half in another.
 *
 * `db:seed:e2e-users` now provisions the primary account as well, under
 * exactly this address, with exactly one membership in the tenant
 * `db:seed:demo` fills. The default below and the default in
 * `packages/db/src/seed-e2e-users.ts` are deliberately the same literal.
 */
export const PRIMARY_ACCOUNT: {
  email: string;
  password: string | undefined;
  storageState: string;
  roles: readonly string[];
} = {
  email: process.env.E2E_EMAIL || "e2e-admin@arctos.local",
  // `E2E_PASSWORD` when the operator keeps a separate password for the primary
  // account, otherwise the shared one — the same fallback the seed applies, so
  // a single export is enough for a full run.
  password: process.env.E2E_PASSWORD || ROLE_PASSWORD,
  storageState: STORAGE_STATE,
  roles: ["admin"],
};

export const ROLE_ACCOUNTS: readonly RoleAccount[] = [
  {
    key: "owner",
    email: process.env.E2E_OWNER_EMAIL ?? "e2e-owner@arctos.local",
    password: ROLE_PASSWORD,
    storageState: STORAGE_STATE_OWNER,
    roles: ["process_owner"],
  },
  {
    key: "reviewer",
    email: process.env.E2E_REVIEWER_EMAIL ?? "e2e-reviewer@arctos.local",
    password: ROLE_PASSWORD,
    storageState: STORAGE_STATE_REVIEWER,
    roles: ["auditor", "compliance_officer"],
  },
  {
    key: "approver",
    email: process.env.E2E_APPROVER_EMAIL ?? "e2e-approver@arctos.local",
    password: ROLE_PASSWORD,
    storageState: STORAGE_STATE_APPROVER,
    roles: ["admin"],
  },
];

export function roleAccount(key: RoleAccount["key"]): RoleAccount {
  const found = ROLE_ACCOUNTS.find((a) => a.key === key);
  if (!found) throw new Error(`unknown role account '${key}'`);
  return found;
}

/**
 * True when the run was given a password for the role accounts.
 *
 * No spec may skip itself on this — a silently skipped separation-of-duties
 * test is exactly the hole S11-07/S11-08 closed. It exists so `auth.setup.ts`
 * can fail once, with a precise message, instead of three identical login
 * timeouts further downstream.
 */
export const ROLE_ACCOUNTS_CONFIGURED = Boolean(ROLE_PASSWORD);
