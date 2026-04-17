// Session type augmentations for Auth.js (ADR-007 rev.1)
import type { UserRole, LineOfDefense } from "@grc/shared";

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
    };
  }
}
