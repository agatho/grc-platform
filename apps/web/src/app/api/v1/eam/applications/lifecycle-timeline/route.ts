import { db, architectureElement, applicationPortfolio } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/applications/lifecycle-timeline — Timeline data
export const GET = withErrorHandler(async function GET(req: Request) {
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
    .innerJoin(
      architectureElement,
      eq(applicationPortfolio.elementId, architectureElement.id),
    )
    .where(eq(applicationPortfolio.orgId, ctx.orgId))
    .orderBy(asc(applicationPortfolio.plannedEol));

  return Response.json({ data });
});
