// Regression guard for the document-control role.
//
// ── #S06-12 (ARCTOS-FULL-2026-08-31, Medium) — CONFIRMED FIXED ──────
// The finding was that `quality_manager` existed in the TypeScript role
// union but NOT in the shipped `user_role` DB enum, so the role could
// never be assigned. Everything built around it was dead code:
//   - the `?raw=1` branch of both document download routes, which reads
//     `requireRole("admin", "quality_manager")` and was effectively
//     "admin only";
//   - `POST /api/v1/processes/[id]/sign-off`;
//   - the signer-role picker in process-sign-off-tab.tsx.
//
// WP3 fixed this at the root (S02-14): `USER_ROLES` in
// packages/shared/src/types/platform.ts is now the single source, and
// migration 0410 mirrors all 20 values into the enum. WP7 therefore does
// NOT re-fix it — it pins the outcome so a future divergence between the
// two sources fails here rather than silently disabling the control
// again.
//
// The DB half is asserted by packages/db against a migrated database;
// what this test can prove in-process is that the role exists in the
// single source and in the Drizzle enum that mirrors the DB.

import { describe, it, expect } from "vitest";
import { USER_ROLES } from "@grc/shared";
// Relative import of the schema module: `@grc/db`'s index opens a
// connection pool, which a unit test must not need.
import { userRoleEnum } from "../../../../../packages/db/src/schema/platform";

/** Roles the DMS controlled-copy design depends on. */
const DOCUMENT_CONTROL_ROLES = ["admin", "quality_manager"] as const;

describe("document-control roles (S06-12)", () => {
  it("quality_manager is part of the single source of truth", () => {
    expect(USER_ROLES).toContain("quality_manager");
  });

  it("the Drizzle enum mirrors it, so the value is assignable in the DB", () => {
    expect(userRoleEnum.enumValues).toContain("quality_manager");
  });

  it("TS union and Drizzle enum do not diverge", () => {
    // The finding's root cause was exactly this divergence (9 DB values
    // vs. 20 TS values vs. 17 guard values).
    expect([...userRoleEnum.enumValues].sort()).toEqual([...USER_ROLES].sort());
  });

  it("every role the ?raw=1 guard names is actually assignable", () => {
    for (const role of DOCUMENT_CONTROL_ROLES) {
      expect(
        userRoleEnum.enumValues as readonly string[],
        `requireRole("${role}") would be dead code`,
      ).toContain(role);
    }
  });
});
