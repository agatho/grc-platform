import { withAuth } from "@/lib/api";
import { getUpcomingEvents } from "@/lib/services/calendar-aggregation";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/calendar/upcoming — Next 7 days (dashboard widget)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    50,
    Math.max(1, Number(searchParams.get("limit")) || 10),
  );

  const events = await getUpcomingEvents(ctx.orgId, limit);

  // Add urgency and daysUntil for dashboard display
  const now = new Date();
  const enriched = events.map((event) => {
    const startDate = new Date(event.startAt);
    const daysUntil = Math.ceil(
      (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    let urgency: "green" | "yellow" | "red" = "green";
    if (daysUntil <= 1) urgency = "red";
    else if (daysUntil <= 3) urgency = "yellow";

    return {
      ...event,
      daysUntil,
      urgency,
    };
  });

  return Response.json({ data: enriched, total: enriched.length });
});
