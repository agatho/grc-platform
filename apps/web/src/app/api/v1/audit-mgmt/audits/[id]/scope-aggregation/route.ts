// Audit Overhaul Phase 2: Scope-aggregation — what does this audit touch.
// Returns findings grouped by linked process / control, plus risk overlay.

import { db, audit } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("audit", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;
  const [a] = await db
    .select({ id: audit.id, scopeProcesses: audit.scopeProcesses })
    .from(audit)
    .where(and(eq(audit.id, id), eq(audit.orgId, ctx.orgId), isNull(audit.deletedAt)));
  if (!a) return Response.json({ error: "Audit not found" }, { status: 404 });

  const data = await withReadContext(ctx, async (tx) => {
    const byProcess = (await tx.execute(sql`
      SELECT
        p.id AS process_id,
        p.name AS process_name,
        p.department,
        COUNT(f.id) FILTER (WHERE f.deleted_at IS NULL)::int AS finding_count,
        COUNT(f.id) FILTER (WHERE f.severity = 'critical' AND f.deleted_at IS NULL)::int AS critical_count,
        COUNT(f.id) FILTER (
          WHERE f.deleted_at IS NULL
            AND f.status NOT IN ('verified','closed','cancelled','remediated')
        )::int AS open_count
      FROM process p
      JOIN finding f ON f.org_id = ${ctx.orgId} AND f.audit_id = ${id}
        AND (f.process_id = p.id OR f.process_step_id IN (SELECT id FROM process_step WHERE process_id = p.id))
      WHERE p.org_id = ${ctx.orgId} AND p.deleted_at IS NULL
      GROUP BY p.id, p.name, p.department
      ORDER BY critical_count DESC, finding_count DESC
    `)) as any[];

    const byControl = (await tx.execute(sql`
      SELECT
        c.id AS control_id,
        c.title AS control_title,
        c.status AS control_status,
        COUNT(f.id)::int AS finding_count,
        COUNT(f.id) FILTER (WHERE f.severity = 'critical')::int AS critical_count
      FROM control c
      JOIN finding f ON f.org_id = ${ctx.orgId} AND f.audit_id = ${id}
        AND f.control_id = c.id AND f.deleted_at IS NULL
      WHERE c.org_id = ${ctx.orgId} AND c.deleted_at IS NULL
      GROUP BY c.id, c.title, c.status
      ORDER BY critical_count DESC, finding_count DESC
    `)) as any[];

    const relatedRisks = (await tx.execute(sql`
      SELECT DISTINCT r.id, r.title, r.risk_score_inherent, r.risk_score_residual
      FROM risk r
      JOIN finding f ON f.risk_id = r.id AND f.audit_id = ${id} AND f.deleted_at IS NULL
      WHERE r.org_id = ${ctx.orgId} AND r.deleted_at IS NULL
      ORDER BY r.risk_score_residual DESC NULLS LAST
      LIMIT 50
    `)) as any[];

    return { byProcess, byControl, relatedRisks };
  });

  return Response.json({
    data: {
      auditId: id,
      scopeProcessIds: a.scopeProcesses ?? [],
      ...data,
    },
  });
}
