import { db, architectureElement, applicationPortfolio } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNotNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/applications/portfolio-quadrant — Quadrant chart data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const data = await db
    .select({
      id: architectureElement.id,
      name: architectureElement.name,
      businessValue: applicationPortfolio.businessValue,
      technicalCondition: applicationPortfolio.technicalCondition,
      annualCost: applicationPortfolio.annualCost,
      userCount: applicationPortfolio.userCount,
      timeClassification: applicationPortfolio.timeClassification,
      lifecycleStatus: applicationPortfolio.lifecycleStatus,
    })
    .from(applicationPortfolio)
    .innerJoin(
      architectureElement,
      eq(applicationPortfolio.elementId, architectureElement.id),
    )
    .where(
      and(
        eq(applicationPortfolio.orgId, ctx.orgId),
        isNotNull(applicationPortfolio.businessValue),
        isNotNull(applicationPortfolio.technicalCondition),
      ),
    );

  return Response.json({ data });
}
