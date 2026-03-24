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
    };
  }
}
