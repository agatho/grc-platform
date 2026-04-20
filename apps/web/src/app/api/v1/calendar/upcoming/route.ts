import { withAuth } from "@/lib/api";
import { getUpcomingEvents } from "@/lib/services/calendar-aggregation";

// GET /api/v1/calendar/upcoming — Next 7 days (dashboard widget)
export async function GET(req: Request) {
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
}
