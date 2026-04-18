// GET /api/v1/bcms/crisis/[id]/dora-timer
//
// Sprint 2.4: DORA Art. 19 Meldefristen-Countdown.
// Liefert aktuelle Deadline-Status fuer Early-Warning (4h),
// Intermediate-Report (72h), Final-Report (1 Monat).

import { db, crisisScenario } from "@grc/db";
import { requireModule } from "@grc/auth";
import { computeDoraDeadlines } from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [crisis] = await db
    .select()
    .from(crisisScenario)
    .where(and(eq(crisisScenario.id, id), eq(crisisScenario.orgId, ctx.orgId)));
  if (!crisis) {
    return Response.json({ error: "Crisis scenario not found" }, { status: 404 });
  }

  if (!crisis.activatedAt) {
    return Response.json({
      data: {
        crisisId: id,
        status: crisis.status,
        activatedAt: null,
        dora: null,
        hint: "Crisis noch nicht activated -- DORA-Timer startet mit Activation.",
      },
    });
  }

  const dora = computeDoraDeadlines(new Date(crisis.activatedAt));

  // Urgency-Level fuer UI-Farbe
  let urgency: "green" | "yellow" | "orange" | "red" = "green";
  if (dora.nextDeadlineLabel !== "none" && dora.secondsToNextDeadline !== null) {
    const minutesLeft = dora.secondsToNextDeadline / 60;
    if (dora.finalOverdue || dora.intermediateOverdue) {
      urgency = "red";
    } else if (minutesLeft < 60) {
      urgency = "red";
    } else if (minutesLeft < 240) {
      urgency = "orange";
    } else if (minutesLeft < 1440) {
      urgency = "yellow";
    }
  }

  return Response.json({
    data: {
      crisisId: id,
      status: crisis.status,
      activatedAt: crisis.activatedAt,
      dora: {
        ...dora,
        // ISO-Datums-Strings fuer einfacheres Rendering im Frontend
        earlyWarningDueAtIso: dora.earlyWarningDueAt.toISOString(),
        intermediateReportDueAtIso: dora.intermediateReportDueAt.toISOString(),
        finalReportDueAtIso: dora.finalReportDueAt.toISOString(),
      },
      urgency,
    },
  });
}
