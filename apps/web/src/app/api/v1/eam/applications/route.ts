import { db, architectureElement, applicationPortfolio } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { problem, getRequestId } from "@/lib/api-errors";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/eam/applications — Application list with portfolio data
export const GET = withErrorHandler(async function GET(req: Request) {
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

  let filtered = apps;
  if (lifecycleStatus) {
    filtered = filtered.filter(
      (a) => a.portfolio?.lifecycleStatus === lifecycleStatus,
    );
  }
  if (timeClassification) {
    filtered = filtered.filter(
      (a) => a.portfolio?.timeClassification === timeClassification,
    );
  }

  return Response.json({ data: filtered });
});
// #NIGHT-009/017: explicit 405 with Allow header so callers learn the
// route is read-only here. Application creation lives elsewhere
// (admin-side import; sub-routes for portfolio/lifecycle).
export function POST(req: Request) {
  return problem.methodNotAllowed({
    requestId: getRequestId(req),
    instance: req.url,
    method: "POST",
    allow: ["GET"],
  });
}
export const PUT = POST;
export const PATCH = POST;
export const DELETE = POST;
