import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/isms/assets/:id/audit-summary — Get latest audit date/result
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: assetId } = await params;

  // Query latest audit involving this asset (via work_item links or audit scope)
  // This is a computed view — no dedicated table needed
  const result = await db.execute(
    sql`SELECT
          a.id as audit_id,
          a.title as audit_title,
          a.end_date as last_audit_date,
          a.status as audit_status,
          COALESCE(
            (SELECT COUNT(*) FROM finding f
             WHERE f.source_entity_id = a.id
               AND f.org_id = ${ctx.orgId}
               AND f.severity = 'major'),
            0
          ) as major_findings,
          CASE
            WHEN a.status = 'completed' AND NOT EXISTS (
              SELECT 1 FROM finding f
              WHERE f.source_entity_id = a.id
                AND f.org_id = ${ctx.orgId}
                AND f.severity IN ('major', 'critical')
            ) THEN 'conformity'
            WHEN a.status = 'completed' AND EXISTS (
              SELECT 1 FROM finding f
              WHERE f.source_entity_id = a.id
                AND f.org_id = ${ctx.orgId}
                AND f.severity = 'critical'
            ) THEN 'major_non_conformity'
            WHEN a.status = 'completed' THEN 'minor_non_conformity'
            ELSE 'not_audited'
          END as audit_result
        FROM audit a
        JOIN work_item_link wil ON wil.target_id = a.work_item_id
        JOIN work_item wi ON wi.id = wil.source_id
        JOIN asset ast ON ast.work_item_id = wi.id
        WHERE ast.id = ${assetId}
          AND ast.org_id = ${ctx.orgId}
        ORDER BY a.end_date DESC NULLS LAST
        LIMIT 1`,
  );

  const row = result[0];
  if (!row) {
    return Response.json({
      data: {
        lastAuditDate: null,
        lastAuditResult: "not_audited",
        auditId: null,
        auditTitle: null,
        majorFindings: 0,
      },
    });
  }

  return Response.json({
    data: {
      lastAuditDate: row.last_audit_date,
      lastAuditResult: row.audit_result,
      auditId: row.audit_id,
      auditTitle: row.audit_title,
      majorFindings: Number(row.major_findings),
    },
  });
}
