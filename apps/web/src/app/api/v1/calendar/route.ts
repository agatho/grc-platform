import { withAuth, paginate } from "@/lib/api";
import { getCalendarEvents } from "@/lib/services/calendar-aggregation";
import type { CalendarFilters } from "@grc/shared";

// GET /api/v1/calendar — Aggregated calendar events
export async function GET(req: Request) {
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
    return Response.json(
      { error: "Invalid date format for from/to parameters" },
      { status: 422 },
    );
  }

  // Max range: 13 months
  const maxRange = 13 * 30 * 24 * 60 * 60 * 1000;
  if (toDate.getTime() - fromDate.getTime() > maxRange) {
    return Response.json(
      { error: "Date range must not exceed 13 months" },
      { status: 422 },
    );
  }

  const filters: CalendarFilters = {};

  const modulesParam = searchParams.get("modules");
  if (modulesParam) {
    filters.modules = modulesParam.split(",").filter(Boolean);
  }

  const responsibleParam = searchParams.get("responsible");
  if (responsibleParam) {
    filters.responsible = responsibleParam;
  }

  const events = await getCalendarEvents(ctx.orgId, fromDate, toDate, filters);

  return Response.json({ data: events, total: events.length });
}
