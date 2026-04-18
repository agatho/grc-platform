// GET /api/v1/dpms/dsr/[id]/deadline
//
// Sprint 3.3: DSR-Deadline-Countdown (Art. 12(3) -- 30d + Extension +60d).

import { db, dsr } from "@grc/db";
import { requireModule } from "@grc/auth";
import { computeDsrDeadline } from "@grc/shared";
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
    .from(dsr)
    .where(and(eq(dsr.id, id), eq(dsr.orgId, ctx.orgId)));
  if (!row) {
    return Response.json({ error: "DSR not found" }, { status: 404 });
  }

  const d = computeDsrDeadline(new Date(row.receivedAt));

  return Response.json({
    data: {
      dsrId: row.id,
      status: row.status,
      requestType: row.requestType,
      receivedAt: row.receivedAt,
      standardDeadlineIso: d.standardDeadline.toISOString(),
      extendedDeadlineIso: d.extendedDeadline.toISOString(),
      daysRemaining: d.daysRemaining,
      daysExtendedRemaining: d.daysExtendedRemaining,
      standardOverdue: d.standardOverdue,
      extendedOverdue: d.extendedOverdue,
      urgency: d.urgency,
      hint:
        d.urgency === "red"
          ? "Kritisch. Antwort priorisieren."
          : d.urgency === "orange"
            ? "Zeit wird knapp -- Extension dokumentieren falls noetig."
            : d.urgency === "yellow"
              ? "Frist im Blick behalten."
              : "Ausreichend Zeit.",
    },
  });
}
