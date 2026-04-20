import { db, architectureElement, applicationPortfolio } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, lte, gte, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/applications/approaching-eol — Applications within X months of EOL
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const months = parseInt(url.searchParams.get("months") ?? "6");

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() + months);

  const data = await db
    .select({
      id: architectureElement.id,
      name: architectureElement.name,
      plannedEol: applicationPortfolio.plannedEol,
      lifecycleStatus: applicationPortfolio.lifecycleStatus,
      vendorName: applicationPortfolio.vendorName,
      userCount: applicationPortfolio.userCount,
    })
    .from(applicationPortfolio)
    .innerJoin(
      architectureElement,
      eq(applicationPortfolio.elementId, architectureElement.id),
    )
    .where(
      and(
        eq(applicationPortfolio.orgId, ctx.orgId),
        lte(
          applicationPortfolio.plannedEol,
          cutoffDate.toISOString().split("T")[0]!,
        ),
      ),
    );

  return Response.json({ data });
}
