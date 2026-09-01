// recipients.ts — the one place that resolves "who in this org should be
// told about this".
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-07 (High)]
//
// Nine cron jobs resolved recipients through `user_organization_role`.
// Eight of them did not filter `deleted_at`. Revoking an org role in the UI
// is a SOFT delete — `UPDATE user_organization_role SET deleted_at = now(),
// deleted_by = …` — and `user.is_active` stays true whenever the person is
// still a member of a *different* organisation, which is the normal case in
// a group structure with `parent_org_id`.
//
// The consequence the audit reproduced against the live database: a user
// whose admin role had been revoked was still returned by
// `wb-deadline-monitor`'s recipient query. That job sends whistleblower
// case numbers and missed-HinSchG-deadline notices. HinSchG §8 requires
// strict confidentiality of the reporting procedure towards everyone not
// entrusted with handling it. `wb-retaliation-check` behaved the same way
// for suspected-retaliation cases.
//
// The only job that got it right, `kri-overdue-alert.ts`, is the model:
// `isNull(userOrganizationRole.deletedAt)`. Rather than repeat that filter
// in eight more places and hope it stays correct, every job now calls this
// resolver.

import { db, user, userOrganizationRole } from "@grc/db";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

export interface ResolveOptions {
  /** Cap the number of recipients returned. */
  limit?: number;
  /**
   * When several roles are acceptable, prefer holders of this one — used by
   * the automation engine, which asks for "<role> or an admin" and should
   * not always land on an admin.
   */
  preferRole?: string;
  /** Include users whose account is deactivated. Default: no. */
  includeInactiveUsers?: boolean;
}

/**
 * User ids of the active members of `orgId` who currently hold one of
 * `roles`.
 *
 * Guarantees, all of which were missing from at least one of the nine
 * call sites:
 *   * the role assignment is not soft-deleted;
 *   * the user account is active;
 *   * the user is not soft-deleted;
 *   * no duplicates when someone holds two of the requested roles.
 */
export async function resolveOrgRecipients(
  orgId: string,
  roles: string[],
  opts: ResolveOptions = {},
): Promise<string[]> {
  if (roles.length === 0) return [];
  const conditions = [
    eq(userOrganizationRole.orgId, orgId),
    inArray(
      userOrganizationRole.role,
      roles as (typeof userOrganizationRole.role.enumValues)[number][],
    ),
    isNull(userOrganizationRole.deletedAt),
    isNull(user.deletedAt),
  ];
  if (!opts.includeInactiveUsers) conditions.push(eq(user.isActive, true));

  const rows = await db
    .selectDistinct({
      userId: userOrganizationRole.userId,
      rank: opts.preferRole
        ? sql<number>`CASE WHEN ${userOrganizationRole.role} = ${opts.preferRole} THEN 0 ELSE 1 END`
        : sql<number>`0`,
    })
    .from(userOrganizationRole)
    .innerJoin(user, eq(user.id, userOrganizationRole.userId))
    .where(and(...conditions))
    .orderBy(
      opts.preferRole
        ? sql`CASE WHEN ${userOrganizationRole.role} = ${opts.preferRole} THEN 0 ELSE 1 END`
        : sql`1`,
    )
    .limit(opts.limit ?? 500);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    if (seen.has(row.userId)) continue;
    seen.add(row.userId);
    out.push(row.userId);
  }
  return out;
}

/**
 * Raw-SQL variant for the jobs that resolve recipients inside a
 * `db.execute` block. Same guarantees; kept so those call sites do not have
 * to be restructured to use the query builder.
 */
export async function resolveOrgRecipientsSql(
  orgId: string,
  roles: string[],
): Promise<string[]> {
  if (roles.length === 0) return [];
  // `role::text = ANY($1)` keeps the role list a bound parameter — no
  // identifier or literal interpolation — and sidesteps the enum cast that
  // an `ANY(ARRAY[…]::user_role[])` form would need.
  const rows = await db.execute<{ user_id: string }>(sql`
    SELECT DISTINCT uor.user_id
      FROM user_organization_role uor
      JOIN "user" u ON u.id = uor.user_id
     WHERE uor.org_id = ${orgId}::uuid
       AND uor.role::text = ANY(${roles})
       AND uor.deleted_at IS NULL
       AND u.is_active = true
       AND u.deleted_at IS NULL`);
  return (rows as unknown as Array<{ user_id: string }>).map((r) => r.user_id);
}
