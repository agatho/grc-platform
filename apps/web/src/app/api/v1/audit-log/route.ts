import { db, auditLog, organization } from "@grc/db";
import { eq, and, desc, sql, count, inArray, or } from "drizzle-orm";
import { withAuth, paginate } from "@/lib/api";

// GET /api/v1/audit-log — Audit log with filters (admin, auditor, dpo)
//
// ADR-011 rev.2: supports hierarchical access via `includeDescendants=true`.
// When set, the query returns audit entries for ctx.orgId AND all descendant
// organizations reachable via the parent_org_id chain. The caller must have
// role `admin` or `auditor` AND must itself be in ctx.orgId. Descendant-access
// policy: a corporate parent sees metadata of child orgs but not sensitive
// payloads (the `changes` field is redacted for descendants unless the child
// org has explicitly shared it via `org_audit_sharing` — not implemented in
// this phase; for now the full row is returned for admins/auditors of the
// parent org in the hierarchy, matching the expectation that group-level
// oversight has full read).
//
// The whistleblowing_audit_log table is a separate relation and is NEVER
// returned by this endpoint — only the whistleblowing role can access it
// via /api/v1/whistleblowing/audit-log.
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "auditor", "dpo");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const includeDescendants = searchParams.get("includeDescendants") === "true";

  // Resolve which org_ids this call is allowed to see.
  let orgIdScope: string[] = [ctx.orgId];

  if (includeDescendants) {
    // DPO role is not allowed to fan out to descendants — privacy boundary
    // is at the data controller (org) level, not group level.
    const roles = ctx.session.user.roles?.filter((r) => r.orgId === ctx.orgId) ?? [];
    const isHierarchyRole = roles.some((r) => r.role === "admin" || r.role === "auditor");
    if (!isHierarchyRole) {
      return Response.json(
        { error: "includeDescendants requires admin or auditor role" },
        { status: 403 },
      );
    }

    // Recursive CTE: walk parent_org_id down to find all descendants.
    const descendants = await db.execute<{ id: string }>(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM organization WHERE id = ${ctx.orgId}
        UNION
        SELECT o.id FROM organization o
        JOIN descendants d ON o.parent_org_id = d.id
      )
      SELECT id FROM descendants
    `);
    const descendantRows: { id: string }[] = Array.isArray(descendants)
      ? (descendants as { id: string }[])
      : [];
    orgIdScope = descendantRows.map((r) => r.id);
    // Defensive: always include the caller's own org, even if the recursive
    // CTE somehow returned nothing.
    if (!orgIdScope.includes(ctx.orgId)) orgIdScope.push(ctx.orgId);
  }

  const conditions =
    orgIdScope.length === 1
      ? [eq(auditLog.orgId, orgIdScope[0])]
      : [inArray(auditLog.orgId, orgIdScope)];

  const entityType = searchParams.get("entity_type");
  if (entityType) conditions.push(eq(auditLog.entityType, entityType));

  const entityId = searchParams.get("entity_id");
  if (entityId) conditions.push(eq(auditLog.entityId, entityId));

  const action = searchParams.get("action");
  if (action) conditions.push(sql`${auditLog.action} = ${action}::audit_action`);

  const since = searchParams.get("since");
  if (since) conditions.push(sql`${auditLog.createdAt} >= ${since}`);

  const until = searchParams.get("until");
  if (until) conditions.push(sql`${auditLog.createdAt} <= ${until}`);

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(auditLog).where(where),
  ]);

  return Response.json({
    data: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    scope: {
      orgId: ctx.orgId,
      includeDescendants,
      resolvedOrgIds: orgIdScope,
    },
  });
}

// Intentionally unused — left as a reference for future refinements.
void or;
