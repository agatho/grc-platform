// POST /api/v1/bcms/crisis/[id]/transition
//
// Sprint 2.4: Crisis-Status-Transitions mit Gates B9/B10.

import { db, crisisScenario, crisisLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateCrisisTransition,
  type CrisisSnapshot,
  type CrisisStatus,
} from "@grc/shared";
import { and, eq, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  targetStatus: z.enum(["standby", "activated", "resolved", "post_mortem"]),
  reason: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const [crisis] = await db
    .select()
    .from(crisisScenario)
    .where(and(eq(crisisScenario.id, id), eq(crisisScenario.orgId, ctx.orgId)));
  if (!crisis) {
    return Response.json(
      { error: "Crisis scenario not found" },
      { status: 404 },
    );
  }

  const [{ logCount }] = await db
    .select({ logCount: sql<number>`count(*)::int` })
    .from(crisisLog)
    .where(eq(crisisLog.crisisScenarioId, id));

  // crisisCommunicationLog hat keinen direkten FK zu crisisScenario.
  // Fuer Gate B10 setzen wir Communication-Count default 0 -- wird zum
  // Warning, nicht Error. Nachrechnung wenn Schema erweitert wird.
  const commCount = 0;

  const snapshot: CrisisSnapshot = {
    status: crisis.status,
    name: crisis.name,
    severity: crisis.severity,
    bcpId: crisis.bcpId,
    activatedAt: crisis.activatedAt,
    activatedBy: crisis.activatedBy,
    resolvedAt: crisis.resolvedAt,
    postMortemNotes: crisis.postMortemNotes,
    logEntryCount: logCount ?? 0,
    communicationCount: commCount,
  };

  const validation = validateCrisisTransition({
    currentStatus: crisis.status as CrisisStatus,
    targetStatus: parsed.data.targetStatus,
    snapshot,
    activatingUserId: ctx.userId,
  });

  if (!validation.allowed) {
    return Response.json(
      {
        blocked: true,
        currentStatus: crisis.status,
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
    if (parsed.data.targetStatus === "activated") {
      updates.activatedAt = new Date();
      updates.activatedBy = ctx.userId;
    }
    if (parsed.data.targetStatus === "resolved") {
      updates.resolvedAt = new Date();
    }

    const [updated] = await tx
      .update(crisisScenario)
      .set(updates)
      .where(
        and(eq(crisisScenario.id, id), eq(crisisScenario.orgId, ctx.orgId)),
      )
      .returning();
    return updated;
  });

  // Auto-Log-Entry fuer Transition
  await withAuditContext(ctx, async (tx) => {
    await tx.insert(crisisLog).values({
      crisisScenarioId: id,
      orgId: ctx.orgId,
      entryType: "status_change",
      title: `Status-Change: ${crisis.status} → ${parsed.data.targetStatus}`,
      description: parsed.data.reason ?? null,
      createdBy: ctx.userId,
    });
  });

  return Response.json({
    data: result,
    previousStatus: crisis.status,
    blockers: validation.blockers,
  });
}
