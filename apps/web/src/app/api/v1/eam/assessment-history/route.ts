import { db, applicationAssessmentHistory } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/applications/:id/assessment-history — Assessment change history
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const applicationPortfolioId = url.searchParams.get("applicationPortfolioId");
  const dimension = url.searchParams.get("dimension");

  if (!applicationPortfolioId) {
    return Response.json({ error: "applicationPortfolioId required" }, { status: 400 });
  }

  let query = db.select().from(applicationAssessmentHistory)
    .where(and(
      eq(applicationAssessmentHistory.orgId, ctx.orgId),
      eq(applicationAssessmentHistory.applicationPortfolioId, applicationPortfolioId),
    ))
    .orderBy(desc(applicationAssessmentHistory.changedAt))
    .limit(100);

  const history = await query;

  const filtered = dimension
    ? history.filter((h) => h.dimension === dimension)
    : history;

  return Response.json({ data: filtered });
}
