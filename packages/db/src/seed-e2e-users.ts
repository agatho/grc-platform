// packages/db/src/seed-e2e-users.ts
//
// `npm run db:seed:e2e-users` — provisions the ROLE ACCOUNTS the E2E suite
// needs in order to test separation of duties.
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
//   * NO platform_admin row, and an existing one is revoked. A platform
//     administrator may create top-level tenants, which is why
//     `f-02-org-create`'s "an org admin cannot create a top-level tenant"
//     could not mean what it says while the suite ran as one.
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

import postgres from "postgres";
import { hash } from "bcryptjs";

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

export interface E2eRoleAccount {
  /** Environment variable the Playwright setup reads the address from. */
  envVar: string;
  email: string;
  name: string;
  roles: readonly string[];
}

/**
 * The role accounts, in one place. `apps/web/e2e/auth.setup.ts` reads the same
 * addresses from the same environment variables with the same defaults.
 */
export const E2E_ROLE_ACCOUNTS: readonly E2eRoleAccount[] = [
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

  const password = process.env.E2E_ROLE_PASSWORD;
  if (!password || password.length < 12) {
    console.error(
      "E2E_ROLE_PASSWORD must be set and at least 12 characters.\n" +
        "There is no default: WP3/S02-01 removed the last hardcoded password\n" +
        "from this repository and this script does not add a new one.",
    );
    process.exit(1);
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

    const passwordHash = await hash(password, 12);

    for (const account of E2E_ROLE_ACCOUNTS) {
      const email = (
        process.env[account.envVar] ?? account.email
      ).toLowerCase();

      const [row] = await sql<{ id: string }[]>`
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

      // No cross-tenant power. `f-02-org-create` asserts that an ORG admin is
      // refused a top-level tenant with 403; that assertion is only meaningful
      // for an account that is not also a platform administrator.
      await sql`
        UPDATE platform_admin SET revoked_at = now()
        WHERE user_id = ${row.id}::uuid AND revoked_at IS NULL
      `;

      console.log(
        `  ${email.padEnd(28)} roles=${account.roles.join(",")}  id=${row.id}`,
      );
    }

    console.log("");
    console.log("E2E role accounts provisioned.");
    if (flag("print-env")) {
      console.log("");
      console.log(`  export E2E_ORG_ID=${orgId}`);
      for (const a of E2E_ROLE_ACCOUNTS) {
        console.log(`  export ${a.envVar}=${process.env[a.envVar] ?? a.email}`);
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
