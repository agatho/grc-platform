import { db, applicationPortfolio, architectureElement } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/dashboards/portfolio-optimization/table — Full assessment detail table
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);

  const apps = await db
    .select({
      element: architectureElement,
      portfolio: applicationPortfolio,
    })
    .from(architectureElement)
    .leftJoin(
      applicationPortfolio,
      eq(architectureElement.id, applicationPortfolio.elementId),
    )
    .where(
      and(
        eq(architectureElement.orgId, ctx.orgId),
        eq(architectureElement.type, "application"),
      ),
    )
    .orderBy(desc(architectureElement.updatedAt))
    .limit(limit);

  return Response.json({ data: apps });
}
