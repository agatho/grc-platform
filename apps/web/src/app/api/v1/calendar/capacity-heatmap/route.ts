import { withAuth } from "@/lib/api";
import { getCapacityHeatmap } from "@/lib/services/calendar-aggregation";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/calendar/capacity-heatmap — Events per day for month view
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(req.url);

  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return Response.json(
      { error: "Missing required query parameters: from, to" },
      { status: 422 },
    );
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return Response.json({ error: "Invalid date format" }, { status: 422 });
  }

  const modulesParam = searchParams.get("modules");
  const filterModules = modulesParam
    ? modulesParam.split(",").filter(Boolean)
    : undefined;

  const heatmap = await getCapacityHeatmap(
    ctx.orgId,
    fromDate,
    toDate,
    filterModules,
  );

  return Response.json({ data: heatmap });
});
