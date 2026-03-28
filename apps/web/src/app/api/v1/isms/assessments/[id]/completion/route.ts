import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/isms/assessments/:id/completion — Get assessment completion %
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

  const { id: assessmentId } = await params;

  // Compute completion: evaluated_items / total_applicable_items * 100
  const result = await db.execute(
    sql`SELECT
          ar.id as assessment_id,
          ar.title as assessment_title,
          COUNT(ace.id) FILTER (WHERE ace.evaluation_result IS NOT NULL) as evaluated_count,
          COUNT(ace.id) as total_count,
          CASE
            WHEN COUNT(ace.id) = 0 THEN 0
            ELSE ROUND(
              COUNT(ace.id) FILTER (WHERE ace.evaluation_result IS NOT NULL)::numeric
              / COUNT(ace.id)::numeric * 100
            )
          END as completion_percentage
        FROM assessment_run ar
        LEFT JOIN assessment_control_eval ace ON ace.assessment_run_id = ar.id
        WHERE ar.id = ${assessmentId}
          AND ar.org_id = ${ctx.orgId}
        GROUP BY ar.id, ar.title`,
  );

  const row = result[0];
  if (!row) {
    return Response.json({ error: "Assessment not found" }, { status: 404 });
  }

  return Response.json({
    data: {
      assessmentId: row.assessment_id,
      assessmentTitle: row.assessment_title,
      evaluatedCount: Number(row.evaluated_count),
      totalCount: Number(row.total_count),
      completionPercentage: Number(row.completion_percentage),
    },
  });
}
