// Sprint 20: Group-to-Role Mapping Resolution
// Maps IdP group names to ARCTOS roles with priority-based resolution

import type { UserRole } from "@grc/shared";
import type { GroupRoleMappingEntry } from "@grc/shared";

/**
 * Role priority (higher number = more privileged).
 * When multiple groups match, the highest-privilege role wins.
 */
const ROLE_PRIORITY: Record<string, number> = {
  admin: 100,
  risk_manager: 70,
  dpo: 70,
  auditor: 60,
  control_owner: 50,
  process_owner: 50,
  viewer: 10,
};

/**
 * Resolve the ARCTOS role for a user based on their IdP group memberships.
 *
 * Rules:
 * 1. Check each IdP group against the mapping
 * 2. If multiple groups match, use the highest-privilege role
 * 3. If no group matches, fall back to defaultRole
 *
 * @param idpGroups - Array of group names from the IdP
 * @param mappings - Array of group-to-role mapping entries
 * @param defaultRole - Fallback role when no groups match
 * @returns The resolved ARCTOS role
 */
export function resolveRole(
  idpGroups: string[],
  mappings: GroupRoleMappingEntry[],
  defaultRole: string = "viewer",
): string {
  if (!idpGroups.length || !mappings.length) {
    return defaultRole;
  }

  const groupSet = new Set(idpGroups);
  let bestRole: string | null = null;
  let bestPriority = -1;

  for (const mapping of mappings) {
    if (groupSet.has(mapping.idpGroup)) {
      const priority = ROLE_PRIORITY[mapping.role] ?? 0;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestRole = mapping.role;
      }
    }
  }

  return bestRole ?? defaultRole;
}

/**
 * Convert a GroupRoleMapping object (from sso_config.group_role_mapping)
 * to an array of GroupRoleMappingEntry.
 */
export function groupRoleMappingToEntries(
  mapping: Record<string, string>,
): GroupRoleMappingEntry[] {
  return Object.entries(mapping).map(([idpGroup, role]) => ({
    idpGroup,
    role,
  }));
}
