// Audit Overhaul Phase 2: Audit-scope RACM view.
//
// For an audit, returns one row per checklist item with: linked control,
// evidence count, finding count + severity counts. Used by the auditor
// detail page and the audit-pack export.

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
  const [existing] = await db
    .select({ id: audit.id, title: audit.title })
    .from(audit)
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );
  if (!existing)
    return Response.json({ error: "Audit not found" }, { status: 404 });

  const rows = await withReadContext(ctx, async (tx) => {
    return tx.execute(sql`
      SELECT
        ci.id AS item_id,
        ci.title AS item_title,
        ci.result AS item_result,
        ci.method_entries AS method_entries,
        c.id AS control_id,
        c.title AS control_title,
        c.status AS control_status,
        (SELECT COUNT(*) FROM audit_evidence ev
           WHERE ev.audit_id = ${id} AND ev.evidence_id IS NOT NULL)::int AS evidence_count,
        (SELECT COUNT(*) FROM finding f
           WHERE f.org_id = ${ctx.orgId} AND f.audit_id = ${id}
             AND f.control_id = c.id
             AND f.deleted_at IS NULL)::int AS finding_count,
        (SELECT COUNT(*) FROM finding f
           WHERE f.org_id = ${ctx.orgId} AND f.audit_id = ${id}
             AND f.control_id = c.id
             AND f.severity = 'critical'
             AND f.deleted_at IS NULL)::int AS critical_finding_count
      FROM audit_checklist ck
      JOIN audit_checklist_item ci ON ci.audit_checklist_id = ck.id
      LEFT JOIN control c ON c.id = ci.control_id
      WHERE ck.audit_id = ${id}
      ORDER BY ck.created_at, ci.created_at
    `);
  });

  // Group result tallies
  const summary = (rows as any[]).reduce(
    (acc, r) => {
      const result = r.item_result ?? "unrated";
      acc.byResult[result] = (acc.byResult[result] ?? 0) + 1;
      acc.totalEvidence += r.evidence_count ?? 0;
      acc.totalFindings += r.finding_count ?? 0;
      acc.criticalFindings += r.critical_finding_count ?? 0;
      acc.itemsWithControl += r.control_id ? 1 : 0;
      return acc;
    },
    {
      itemCount: (rows as any[]).length,
      itemsWithControl: 0,
      totalEvidence: 0,
      totalFindings: 0,
      criticalFindings: 0,
      byResult: {} as Record<string, number>,
    },
  );

  return Response.json({
    data: { auditId: id, auditTitle: existing.title, rows, summary },
  });
}
