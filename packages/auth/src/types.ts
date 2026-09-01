// Session type augmentations for Auth.js (ADR-007 rev.1)
import type { UserRole, LineOfDefense } from "@grc/shared";
// [ARCTOS-FULL-2026-08-31 / WP12 · S14-19/S14-25] `declare module` only
// augments a module that is part of the program. Nothing in packages/auth
// imports `next-auth/jwt` by value, so without these side-effect type imports
// the JWT augmentation below is silently dropped and every `token.*` access
// falls back to `{}` — which is exactly the hole the `as any` casts were
// papering over. Surfaced the moment the package got a tsconfig.json (S14-25).
import type {} from "next-auth";
import type {} from "next-auth/jwt";

export interface RoleAssignment {
  orgId: string;
  role: UserRole;
  lineOfDefense: LineOfDefense | null;
}

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    language?: string;
    roles?: RoleAssignment[];
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      language: string;
      roles: RoleAssignment[];
      /**
       * The currently selected org, resolved from the `arctos-org-id` cookie
       * and validated against `roles`. Falls back to `roles[0]?.orgId` if the
       * cookie is missing or points to an org the user cannot access. Populated
       * server-side in the `session` callback.
       */
      currentOrgId: string | null;
      /**
       * [ARCTOS-FULL-2026-08-31 / WP12 · S14-19] True when the account is
       * deactivated or deleted. Set in the `session` callback next to `roles`
       * (see #WP3-S12-17) and previously written through `as any`, so a rename
       * of this field would have compiled cleanly and silently disabled the
       * fail-closed check.
       */
      disabled: boolean;
    };
  }
}

/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-19] JWT payload.
 *
 * `apps/web/src/auth.ts` and `packages/auth/src/config.ts` wrote the whole
 * authorisation payload through `(token as any).roles = …` /
 * `(session.user as any).roles = …`. That is the single most
 * security-relevant `any` cluster in the codebase (audit S14-19): a field
 * rename or a type change in `RoleAssignment` would not have been caught by
 * the compiler anywhere along the path token → session → `requireRole()`.
 * Declaring the token shape removes the casts entirely.
 */
declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    email?: string;
    name?: string;
    language?: string;
    roles?: RoleAssignment[];
    disabled?: boolean;
  }
}
