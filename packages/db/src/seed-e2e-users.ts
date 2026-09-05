// packages/db/src/seed-e2e-users.ts
//
// `npm run db:seed:e2e-users` — provisions ALL accounts the E2E suite signs
// in as: the primary account it runs under, and the role accounts it needs in
// order to test separation of duties.
//
// [E2E-TRIAGE-4 · 2026-09-02] The tenant split, resolved
// ------------------------------------------------------
// Until this round the suite's PRIMARY account was whatever the operator had
// created with `db:create-admin` (`admin@arctos.local` on the reference
// machine). Measured against the running database, that account held TWENTY
// memberships — the two seed tenants plus one throwaway organisation per
// `f-02`/`f-15` run, growing with every run. Since the active organisation of
// a session is the `arctos-org-id` cookie or, when that cookie does not
// arrive, `roles[0].orgId` (packages/auth/src/context.ts, ordered by
// `user_organization_role.created_at` in packages/auth/src/providers.ts:279),
// and since that cookie is issued with `Secure` and therefore never reaches
// Playwright's `request` fixture over a plain-http target, the suite asserted
// in TWO tenants at once: the browser half in the demo tenant `ccc4cc1c…`,
// the API half in `6d2a7cf8…` — an organisation with, measured, zero assets.
// Two tests were parked on that split (`document-signature`, and half of the
// reason `i-08` never ran).
//
// It is fixed here rather than in the fixtures, because a fix in the fixtures
// is a fix on one machine: `admin@arctos.local` is created by no seed at all,
// so a fresh database could never reproduce the run.
//
// The primary account is now provisioned by THIS script, under the address
// `E2E_EMAIL` names (default `e2e-admin@arctos.local`), with exactly the same
// one-membership rule the role accounts already follow. Pointing `E2E_EMAIL`
// at an existing account MOVES that account into the demo tenant — which is
// what the reference machine does with `admin@arctos.local`. Create or move
// is therefore one mechanism, chosen by what the operator names.
//
// [E2E-TRIAGE-3 · 2026-09-02] Why this exists
// -------------------------------------------
// `bpm-approval-pipeline.spec.ts` walks a process from draft to published and
// then through a multi-stage approval chain. Its last third could never run:
// the suite had exactly ONE account, so the person who created the process,
// defined the approval chain and authored the version was also the only
// candidate to decide it — and `canDecideApprovalStep` (WP3/S02-12) refuses
// exactly that, correctly. Two earlier triage rounds recorded the failure as
// "needs a second provisioned user" and stopped there.
//
// The accounts belong in a script, not in an operator's shell history: the
// next run has to find them again, and CI has to be able to create them from
// nothing. This is that script.
//
//   owner     process_owner                  creates the process, the version
//                                            and the approval chain
//   reviewer  auditor + compliance_officer   decides the REVIEW gate as the
//                                            assigned reviewer
//   approver  admin                          decides the APPROVAL gate as the
//                                            holder of the assigned role, and
//                                            is the org-admin (NOT platform
//                                            admin) `f-02-org-create` needs
//
// Deliberate properties
// ---------------------
//   * ONE membership per account, in ONE organisation. The active org of a
//     session is the `arctos-org-id` cookie or, when that cookie does not
//     arrive, `roles[0].orgId`. The cookie is issued with `Secure`, so over a
//     plain-http test target it reaches the browser but NOT Playwright's
//     `request` fixture — an account with several memberships would run the
//     API-first specs in an unpredictable tenant. With a single membership
//     both paths resolve to the same organisation by construction.
//   * The membership's `created_at` is pinned to a fixed timestamp in the
//     past. `roles[0]` is the OLDEST membership row, and the suite itself
//     creates organisations (`f-02` a subsidiary, `f-15` a top-level tenant)
//     which grant the creator an admin role on the spot. Without the pin the
//     one-membership rule would hold only until the first such spec ran;
//     with it, every membership the suite adds is provably younger and
//     `roles[0]` stays the demo tenant for the rest of the run — and for
//     every later run, because the rows persist. Re-running this script also
//     removes the accumulated throwaway memberships.
//   * `platform_admin` is granted or revoked EXPLICITLY per account, never
//     left as found:
//       - the primary account HOLDS it, because `f-15` creates a top-level
//         tenant (no `parentOrgId`), which the handler reserves for platform
//         administrators (migration 0438);
//       - `e2e-approver` must NOT hold it, because `f-02b` asserts that an
//         organisation admin is refused exactly that action. While the suite
//         ran as one principal, that assertion could not mean what it says.
//   * `must_change_password = false`. These are fixtures whose password the
//     operator supplies through the environment; the first-login change that
//     `db:create-admin` forces (S02-01) would make them unusable to a
//     non-interactive run. They are still ordinary accounts with a real
//     bcrypt hash — no password lives in this file or in the repository.
//   * Idempotent: re-running re-hashes the password, re-activates the account,
//     clears a lockout and reconciles the role set.
//
// Usage:
//   E2E_ROLE_PASSWORD='<at least 12 chars>' \
//   E2E_ORG_ID=<uuid> npm run db:seed:e2e-users
//
//   --org <uuid>   overrides E2E_ORG_ID
//   --print-env    additionally prints the export lines the suite expects
//
//   E2E_EMAIL      address of the primary account (default
//                  `e2e-admin@arctos.local`). Naming an existing account moves
//                  it into the demo tenant.
//   E2E_PASSWORD   its password; falls back to E2E_ROLE_PASSWORD.

import postgres from "postgres";
import { hash } from "bcryptjs";
import { requireRow } from "./sql-result";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/**
 * The default demo tenant. `packages/db/sql/seed_demo_00_platform.sql` writes
 * this id literally, so it is the same on every database `db:seed:demo` has
 * touched — which is why `playwright.config.ts` can default `E2E_ORG_ID` to it
 * instead of asking the operator to remember a UUID.
 */
export const DEMO_TENANT_ORG_ID = "ccc4cc1c-4b09-499c-8420-ebd8da655cd7";

/**
 * The instant every seeded membership is dated to.
 *
 * `roles[0]` — and therefore the tenant an API-first spec runs in — is the
 * oldest `user_organization_role` row. Pinning it into the past makes that
 * deterministic against the organisations the suite creates while it runs.
 */
export const E2E_MEMBERSHIP_EPOCH = "2000-01-01T00:00:00Z";

export interface E2eRoleAccount {
  /** Environment variable the Playwright setup reads the address from. */
  envVar: string;
  email: string;
  name: string;
  roles: readonly string[];
  /**
   * Environment variable holding this account's password. Falls back to
   * `E2E_ROLE_PASSWORD` when unset, so a run may use one password for
   * everything or keep the primary account's own.
   */
  passwordEnvVar?: string;
  /**
   * `platform_admin` membership, decided rather than inherited. `true` grants
   * it, `false` (the default) revokes an existing row.
   */
  platformAdmin?: boolean;
}

/**
 * The accounts, in one place. `apps/web/e2e/fixtures/storage.ts` reads the
 * same addresses from the same environment variables with the same defaults.
 */
export const E2E_ROLE_ACCOUNTS: readonly E2eRoleAccount[] = [
  {
    // The account the suite runs under. `E2E_EMAIL` may name an account that
    // already exists — then this entry MOVES it into the demo tenant.
    envVar: "E2E_EMAIL",
    email: "e2e-admin@arctos.local",
    name: "E2E Administrator",
    roles: ["admin"],
    passwordEnvVar: "E2E_PASSWORD",
    platformAdmin: true,
  },
  {
    envVar: "E2E_OWNER_EMAIL",
    email: "e2e-owner@arctos.local",
    name: "E2E Process Owner",
    roles: ["process_owner"],
  },
  {
    envVar: "E2E_REVIEWER_EMAIL",
    email: "e2e-reviewer@arctos.local",
    name: "E2E Reviewer",
    roles: ["auditor", "compliance_officer"],
  },
  {
    envVar: "E2E_APPROVER_EMAIL",
    email: "e2e-approver@arctos.local",
    name: "E2E Approver",
    roles: ["admin"],
  },
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const rolePassword = process.env.E2E_ROLE_PASSWORD;
  if (!rolePassword || rolePassword.length < 12) {
    console.error(
      "E2E_ROLE_PASSWORD must be set and at least 12 characters.\n" +
        "There is no default: WP3/S02-01 removed the last hardcoded password\n" +
        "from this repository and this script does not add a new one.",
    );
    process.exit(1);
  }

  /** The password for one account: its own variable, else the shared one. */
  function passwordFor(account: E2eRoleAccount): string {
    const own = account.passwordEnvVar
      ? process.env[account.passwordEnvVar]
      : undefined;
    if (own === undefined || own === "") return rolePassword!;
    if (own.length < 12) {
      console.error(
        `${account.passwordEnvVar} is set but shorter than 12 characters — ` +
          "refusing (WP3/S02-01).",
      );
      process.exit(1);
    }
    return own;
  }

  const orgId = arg("org") ?? process.env.E2E_ORG_ID ?? DEMO_TENANT_ORG_ID;
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) {
    console.error(`--org / E2E_ORG_ID is not a UUID: ${orgId}`);
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    const [org] = await sql<{ id: string; name: string }[]>`
      SELECT id, name FROM organization
      WHERE id = ${orgId}::uuid AND deleted_at IS NULL
    `;
    if (!org) {
      throw new Error(
        `Organization ${orgId} does not exist (or is deleted). Run ` +
          "`npm run db:seed:demo` first, or pass --org <uuid>.",
      );
    }
    console.log(`Organization: ${org.name} (${org.id})`);

    for (const account of E2E_ROLE_ACCOUNTS) {
      const email = (
        process.env[account.envVar] || account.email
      ).toLowerCase();
      const passwordHash = await hash(passwordFor(account), 12);

      const rowResult = await sql<{ id: string }[]>`
        INSERT INTO "user" (email, name, password_hash, email_verified,
                            is_active, language, must_change_password)
        VALUES (${email}, ${account.name}, ${passwordHash}, now(), true, 'de',
                false)
        ON CONFLICT (email) DO UPDATE
          SET password_hash        = EXCLUDED.password_hash,
              name                 = EXCLUDED.name,
              is_active            = true,
              must_change_password = false,
              failed_login_attempts = 0,
              locked_until         = NULL,
              deleted_at           = NULL
        RETURNING id
      `;
      const row = requireRow(rowResult, `E2E-Benutzer ${email} anlegen`);

      // Exactly one organisation — see the header. Memberships anywhere else
      // are removed rather than left to decide `roles[0]` by accident.
      await sql`
        DELETE FROM user_organization_role
        WHERE user_id = ${row.id}::uuid AND org_id <> ${orgId}::uuid
      `;
      await sql`
        DELETE FROM user_organization_role
        WHERE user_id = ${row.id}::uuid
          AND org_id = ${orgId}::uuid
          AND role::text <> ALL(${sql.array(account.roles as string[])}::text[])
      `;
      for (const role of account.roles) {
        await sql`
          INSERT INTO user_organization_role (user_id, org_id, role,
                                              line_of_defense)
          VALUES (${row.id}::uuid, ${orgId}::uuid, ${role}, 'first')
          ON CONFLICT DO NOTHING
        `;
        await sql`
          UPDATE user_organization_role SET deleted_at = NULL
          WHERE user_id = ${row.id}::uuid AND org_id = ${orgId}::uuid
            AND role::text = ${role}
        `;
      }

      // Pin the membership into the past — see the header. `roles[0]` is the
      // oldest row, and the suite adds younger ones while it runs.
      await sql`
        UPDATE user_organization_role
        SET created_at = ${E2E_MEMBERSHIP_EPOCH}::timestamptz
        WHERE user_id = ${row.id}::uuid AND org_id = ${orgId}::uuid
      `;

      // Cross-tenant power is decided here, not inherited. See the header for
      // why the primary account has it and `e2e-approver` must not.
      if (account.platformAdmin) {
        await sql`
          INSERT INTO platform_admin (user_id, reason)
          VALUES (${row.id}::uuid, 'E2E primary account (db:seed:e2e-users)')
          ON CONFLICT (user_id) DO UPDATE SET revoked_at = NULL
        `;
      } else {
        await sql`
          UPDATE platform_admin SET revoked_at = now()
          WHERE user_id = ${row.id}::uuid AND revoked_at IS NULL
        `;
      }

      // Say what the account will actually resolve to, rather than what it was
      // asked to be: this is the number that made the tenant split invisible.
      const checkResult = await sql<
        { memberships: string; first_org: string }[]
      >`
        SELECT count(*)::text AS memberships,
               (ARRAY_AGG(org_id::text ORDER BY created_at, org_id))[1]
                 AS first_org
        FROM user_organization_role
        WHERE user_id = ${row.id}::uuid AND deleted_at IS NULL
      `;
      const check = requireRow(
        checkResult,
        `Mitgliedschaften von ${email} pruefen`,
      );
      if (check.first_org !== orgId) {
        throw new Error(
          `${email} would resolve to organisation ${check.first_org}, not ` +
            `${orgId}. roles[0] decides the tenant of every request that ` +
            "does not carry the org cookie — refusing to leave the account " +
            "in that state.",
        );
      }

      console.log(
        `  ${email.padEnd(28)} roles=${account.roles.join(",")}` +
          `  platform_admin=${account.platformAdmin ? "yes" : "no"}` +
          `  memberships=${check.memberships}  id=${row.id}`,
      );
    }

    console.log("");
    console.log("E2E accounts provisioned.");
    if (flag("print-env")) {
      console.log("");
      console.log(`  export E2E_ORG_ID=${orgId}`);
      for (const a of E2E_ROLE_ACCOUNTS) {
        console.log(`  export ${a.envVar}=${process.env[a.envVar] || a.email}`);
      }
      console.log("  export E2E_ROLE_PASSWORD=<the password you just used>");
    }
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/seed-e2e-users.ts")) {
  main().catch((err: unknown) => {
    console.error(
      "seed-e2e-users failed:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  });
}
