import { db, architectureElement, applicationPortfolio } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/applications/approaching-eol — Applications within X months of EOL
export const GET = withErrorHandler(async function GET(req: Request) {
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
});
