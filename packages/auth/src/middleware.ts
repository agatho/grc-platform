import type { UserRole } from "@grc/shared";

// RBAC Middleware (S1-11)
export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: Request) => {
    // TODO: Extract user from Clerk session
    // TODO: Look up roles in user_organization_role table
    // TODO: Check if user has any of allowedRoles in current org
    // TODO: Return 403 if not authorized
    return null; // null = authorized, Response = error
  };
}
