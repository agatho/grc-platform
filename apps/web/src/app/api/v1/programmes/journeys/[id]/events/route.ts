// GET /api/v1/programmes/journeys/[id]/events
// Append-only Event-Log einer Journey (paginiert).

import { db, programmeJourney, programmeJourneyEvent } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, isNull, desc } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(500, Number(url.searchParams.get("limit") ?? 100)),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

  const [journey] = await db
    .select({ id: programmeJourney.id })
    .from(programmeJourney)
    .where(
      and(
        eq(programmeJourney.id, id),
        eq(programmeJourney.orgId, ctx.orgId),
        isNull(programmeJourney.deletedAt),
      ),
    )
    .limit(1);
  if (!journey) {
    return Response.json({ error: "Journey not found" }, { status: 404 });
  }

  const events = await db
    .select()
    .from(programmeJourneyEvent)
    .where(eq(programmeJourneyEvent.journeyId, id))
    .orderBy(desc(programmeJourneyEvent.occurredAt))
    .limit(limit)
    .offset(offset);

  return Response.json({
    data: events,
    pagination: { limit, offset, total: events.length },
  });
}
