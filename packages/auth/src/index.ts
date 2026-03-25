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

// Module config cache (Node.js only)
export * as moduleConfigCache from "./cache/module-config-cache";

// Module guard middleware (Node.js only)
export { requireModule } from "./middleware/module-guard";
