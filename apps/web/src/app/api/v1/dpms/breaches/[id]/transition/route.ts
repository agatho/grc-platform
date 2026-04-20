// POST /api/v1/dpms/breaches/[id]/transition
//
// Sprint 3.4: Breach-Status-Transitions mit 4 Gates (G9-G12).

import { db, dataBreach } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateBreachTransition,
  type BreachSnapshot,
  type BreachStatus,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  targetStatus: z.enum([
    "detected",
    "assessing",
    "notifying_dpa",
    "notifying_individuals",
    "remediation",
    "closed",
  ]),
  reason: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [row] = await db
    .select()
    .from(dataBreach)
    .where(and(eq(dataBreach.id, id), eq(dataBreach.orgId, ctx.orgId)));
  if (!row) {
    return Response.json({ error: "Data breach not found" }, { status: 404 });
  }

  const snapshot: BreachSnapshot = {
    status: row.status,
    title: row.title,
    description: row.description,
    severity: row.severity,
    detectedAt: row.detectedAt,
    dpaNotifiedAt: row.dpaNotifiedAt,
    individualsNotifiedAt: row.individualsNotifiedAt,
    isDpaNotificationRequired: row.isDpaNotificationRequired,
    isIndividualNotificationRequired: row.isIndividualNotificationRequired,
    dataCategoriesAffected: row.dataCategoriesAffected,
    estimatedRecordsAffected: row.estimatedRecordsAffected,
    containmentMeasures: row.containmentMeasures,
    remediationMeasures: row.remediationMeasures,
  };

  const validation = validateBreachTransition({
    currentStatus: row.status as BreachStatus,
    targetStatus: parsed.data.targetStatus,
    snapshot,
  });

  if (!validation.allowed) {
    return Response.json(
      {
        blocked: true,
        currentStatus: row.status,
        targetStatus: parsed.data.targetStatus,
        blockers: validation.blockers,
      },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updates: Record<string, unknown> = {
      status: parsed.data.targetStatus,
      updatedAt: new Date(),
    };
    if (parsed.data.targetStatus === "notifying_dpa") {
      updates.dpaNotifiedAt = new Date();
    }
    if (parsed.data.targetStatus === "notifying_individuals") {
      updates.individualsNotifiedAt = new Date();
    }
    const [updated] = await tx
      .update(dataBreach)
      .set(updates)
      .where(and(eq(dataBreach.id, id), eq(dataBreach.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  return Response.json({
    data: result,
    previousStatus: row.status,
    blockers: validation.blockers,
  });
}
