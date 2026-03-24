// Edge-safe exports (can be used in middleware)
export { authConfig } from "./config";
export {
  requireRole,
  requireLineOfDefense,
  getRolesInOrg,
  getAccessibleOrgIds,
} from "./rbac";
export type { RoleAssignment } from "./types";

// Node.js-only exports — do NOT import these in middleware.
// Use: import { credentialsProvider } from "@grc/auth/providers"
// Use: import { withOrgContext } from "@grc/auth/context"
