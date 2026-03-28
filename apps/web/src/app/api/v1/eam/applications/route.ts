import { db, architectureElement, applicationPortfolio } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/applications — Application list with portfolio data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const lifecycleStatus = url.searchParams.get("lifecycleStatus");
  const timeClassification = url.searchParams.get("timeClassification");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);

  const apps = await db
    .select({
      element: architectureElement,
      portfolio: applicationPortfolio,
    })
    .from(architectureElement)
    .leftJoin(applicationPortfolio, eq(architectureElement.id, applicationPortfolio.elementId))
    .where(
      and(
        eq(architectureElement.orgId, ctx.orgId),
        eq(architectureElement.type, "application"),
      ),
    )
    .orderBy(desc(architectureElement.updatedAt))
    .limit(limit);

  let filtered = apps;
  if (lifecycleStatus) {
    filtered = filtered.filter((a) => a.portfolio?.lifecycleStatus === lifecycleStatus);
  }
  if (timeClassification) {
    filtered = filtered.filter((a) => a.portfolio?.timeClassification === timeClassification);
  }

  return Response.json({ data: filtered });
}
