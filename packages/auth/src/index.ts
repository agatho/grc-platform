// Edge-safe exports (can be used in middleware)
export { authConfig } from "./config";
export {
  requireRole,
  requireLineOfDefense,
  getRolesInOrg,
  getAccessibleOrgIds,
  // #WP3-S12-17 — edge-safe HinSchG predicates, evaluated in BOTH the
  // middleware (JWT copy) and withAuth (fresh DB roles).
  HINSCHG_ISOLATED_ROLES,
  isHinSchgIsolated,
  isHinSchgAllowedPath,
  // #WP3-S02-04/S12-09/S12-18 — the middleware public-path allowlist lives in
  // the edge-safe rbac module so it can be unit-tested.
  isPublicPath,
  isPublicExactOrUnder,
  PUBLIC_PATH_TABLE,
} from "./rbac";
export type { RoleAssignment } from "./types";

// Node.js-only exports — do NOT import these in middleware.
// Use: import { credentialsProvider } from "@grc/auth/providers"
// Use: import { withOrgContext } from "@grc/auth/context"

// Module config cache (Node.js only)
export * as moduleConfigCache from "./cache/module-config-cache";

// Module guard middleware (Node.js only)
export { requireModule } from "./middleware/module-guard";

// #WP3-S02-07 — Massenexport-Guard (pure decision function; the route that
// consumes it belongs to WP8, see /work/audit/remediation/WP3.md).
export {
  decideBulkExport,
  containsPersonalData,
  BULK_EXPORT_ROLES,
  BULK_EXPORT_MAX_ENTITY_TYPES,
  BULK_EXPORT_MAX_ROWS,
  PERSONAL_DATA_ENTITY_TYPES,
} from "./middleware/bulk-export-guard";
export type {
  BulkExportRequest,
  BulkExportDecision,
} from "./middleware/bulk-export-guard";

// Sprint 20: SSO + SCIM services (Node.js only)
export { resolveRole, groupRoleMappingToEntries } from "./role-mapping";
