// GET /api/v1/programmes/journeys/[id]/steps
// Liste aller Schritte einer Journey.

import { db, programmeJourneyStep, programmeJourney } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, isNull, asc } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

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

  const url = new URL(req.url);
  const phaseFilter = url.searchParams.get("phaseId");
  const statusFilter = url.searchParams.get("status");

  const conditions = [
    eq(programmeJourneyStep.journeyId, id),
    eq(programmeJourneyStep.orgId, ctx.orgId),
  ];
  if (phaseFilter) {
    conditions.push(eq(programmeJourneyStep.phaseId, phaseFilter));
  }
  if (statusFilter) {
    conditions.push(eq(programmeJourneyStep.status, statusFilter as never));
  }

  const rows = await db
    .select()
    .from(programmeJourneyStep)
    .where(and(...conditions))
    .orderBy(asc(programmeJourneyStep.sequence));

  return Response.json({ data: rows });
}
