import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { departmentManagerDashboardQuerySchema } from "@grc/shared";

// GET /api/v1/role-dashboards/data/department-manager — Department Manager View
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = departmentManagerDashboardQuerySchema.parse(Object.fromEntries(url.searchParams));

  // Tasks assigned to current user or department
  const [taskSummary] = await db.execute(sql`
    SELECT
      count(*)::int as total_tasks,
      count(*) FILTER (WHERE status = 'open')::int as open_tasks,
      count(*) FILTER (WHERE status = 'overdue' OR (due_date < now() AND status != 'completed'))::int as overdue_tasks,
      count(*) FILTER (WHERE status = 'completed')::int as completed_tasks
    FROM task WHERE org_id = ${ctx.orgId} AND assignee_id = ${ctx.userId}
  `);

  // Risks owned by user
  const [riskSummary] = await db.execute(sql`
    SELECT
      count(*)::int as total_risks,
      count(*) FILTER (WHERE risk_level IN ('critical', 'high'))::int as high_priority_risks
    FROM risk WHERE org_id = ${ctx.orgId} AND owner_id = ${ctx.userId}
  `);

  // Controls owned
  const [controlSummary] = await db.execute(sql`
    SELECT
      count(*)::int as total_controls,
      count(*) FILTER (WHERE effectiveness = 'effective')::int as effective
    FROM control WHERE org_id = ${ctx.orgId} AND owner_id = ${ctx.userId}
  `);

  return Response.json({
    data: {
      tasks: taskSummary,
      risks: riskSummary,
      controls: controlSummary,
      generatedAt: new Date().toISOString(),
    },
  });
}
