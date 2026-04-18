// GET /api/v1/dpms/breaches/[id]/deadline
//
// Sprint 3.4: Art. 33(1) 72h-Deadline-Countdown mit Urgency-Level.

import { db, dataBreach } from "@grc/db";
import { requireModule } from "@grc/auth";
import { computeBreachDeadline } from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const [row] = await db
    .select()
    .from(dataBreach)
    .where(and(eq(dataBreach.id, id), eq(dataBreach.orgId, ctx.orgId)));
  if (!row) {
    return Response.json({ error: "Breach not found" }, { status: 404 });
  }

  if (!row.detectedAt) {
    return Response.json({
      data: {
        breachId: id,
        deadline: null,
        hint: "detectedAt nicht gesetzt -- 72h-Timer startet nicht.",
      },
    });
  }

  const d = computeBreachDeadline(new Date(row.detectedAt));

  return Response.json({
    data: {
      breachId: row.id,
      status: row.status,
      severity: row.severity,
      detectedAt: row.detectedAt,
      deadlineAtIso: d.deadlineAt.toISOString(),
      hoursRemaining: d.hoursRemaining,
      overdue: d.overdue,
      urgency: d.urgency,
      dpaNotifiedAt: row.dpaNotifiedAt,
      individualsNotifiedAt: row.individualsNotifiedAt,
      hint:
        d.overdue && !row.dpaNotifiedAt
          ? "72h-Frist ueberschritten. DPA-Notification MUSS Verzoegerungs-Gruende enthalten (Art. 33(1) Satz 2)."
          : d.urgency === "red"
            ? "Kritisch. < 6h verbleibend."
            : d.urgency === "orange"
              ? "< 24h. Notification vorbereiten."
              : d.urgency === "yellow"
                ? "< 48h. Assessment abschliessen."
                : "Innerhalb des Fensters.",
    },
  });
}
