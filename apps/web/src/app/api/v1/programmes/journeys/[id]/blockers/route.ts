// GET /api/v1/programmes/journeys/[id]/blockers
// Liefert alle Schritte mit blockierendem Status oder fälligen Pflicht-Bedingungen.

import { db, programmeJourney, programmeJourneyStep } from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { eq, and, isNull, or, lt } from "drizzle-orm";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(
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

  const today = new Date().toISOString().slice(0, 10);

  const blockedSteps = await db
    .select()
    .from(programmeJourneyStep)
    .where(
      and(
        eq(programmeJourneyStep.journeyId, id),
        eq(programmeJourneyStep.orgId, ctx.orgId),
        eq(programmeJourneyStep.status, "blocked"),
      ),
    );

  const overdueSteps = await db
    .select()
    .from(programmeJourneyStep)
    .where(
      and(
        eq(programmeJourneyStep.journeyId, id),
        eq(programmeJourneyStep.orgId, ctx.orgId),
        or(
          eq(programmeJourneyStep.status, "pending"),
          eq(programmeJourneyStep.status, "in_progress"),
          eq(programmeJourneyStep.status, "review"),
        ),
        lt(programmeJourneyStep.dueDate, today),
      ),
    );

  return Response.json({
    data: {
      blocked: blockedSteps,
      overdue: overdueSteps,
      summary: {
        blockedCount: blockedSteps.length,
        overdueCount: overdueSteps.length,
      },
    },
  });
});
