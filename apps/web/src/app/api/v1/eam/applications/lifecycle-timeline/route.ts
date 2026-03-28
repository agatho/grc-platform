import { db, architectureElement, applicationPortfolio } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/applications/lifecycle-timeline — Timeline data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const data = await db
    .select({
      id: architectureElement.id,
      name: architectureElement.name,
      plannedIntroduction: applicationPortfolio.plannedIntroduction,
      goLiveDate: applicationPortfolio.goLiveDate,
      plannedEol: applicationPortfolio.plannedEol,
      lifecycleStatus: applicationPortfolio.lifecycleStatus,
    })
    .from(applicationPortfolio)
    .innerJoin(architectureElement, eq(applicationPortfolio.elementId, architectureElement.id))
    .where(eq(applicationPortfolio.orgId, ctx.orgId))
    .orderBy(asc(applicationPortfolio.plannedEol));

  return Response.json({ data });
}
