// POST /api/v1/bcms/bia/[id]/finalize
//
// Sprint 2.1: BIA-Finalize-Endpoint.
// - Hart: Gate B2 muss bestanden sein (Coverage >= 80%)
// - Transition: in_progress -> review (NICHT approved; Approval ist
//   separater Step durch BCM-Manager)
// - Markiert alle bia_process_impacts mit priorityRanking <= 3 automatisch
//   als isEssential=true (wenn noch nicht gesetzt)

import {
  db,
  biaAssessment,
  biaProcessImpact,
  essentialProcess,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  validateBcmsGate2Coverage,
  type BiaCoverageStats,
} from "@grc/shared";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, "POST");
  if (moduleCheck) return moduleCheck;

  const [bia] = await db
    .select()
    .from(biaAssessment)
    .where(and(eq(biaAssessment.id, id), eq(biaAssessment.orgId, ctx.orgId)));
  if (!bia) {
    return Response.json({ error: "BIA not found" }, { status: 404 });
  }
  if (bia.status !== "in_progress") {
    return Response.json(
      { error: `BIA status '${bia.status}' -- finalize nur von 'in_progress' moeglich` },
      { status: 422 },
    );
  }

  // Coverage-Stats
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(biaProcessImpact)
    .where(eq(biaProcessImpact.biaAssessmentId, id));

  const [{ scored }] = await db
    .select({ scored: sql<number>`count(*)::int` })
    .from(biaProcessImpact)
    .where(
      and(
        eq(biaProcessImpact.biaAssessmentId, id),
        sql`${biaProcessImpact.mtpdHours} IS NOT NULL`,
        sql`${biaProcessImpact.rtoHours} IS NOT NULL`,
        sql`${biaProcessImpact.rpoHours} IS NOT NULL`,
      ),
    );

  const [{ essential }] = await db
    .select({ essential: sql<number>`count(*)::int` })
    .from(biaProcessImpact)
    .where(
      and(
        eq(biaProcessImpact.biaAssessmentId, id),
        eq(biaProcessImpact.isEssential, true),
      ),
    );

  const coverageStats: BiaCoverageStats = {
    totalProcessImpacts: total ?? 0,
    scoredImpacts: scored ?? 0,
    essentialCount: essential ?? 0,
    minimumEssentialCount: 3,
  };

  const blockers = validateBcmsGate2Coverage(coverageStats);
  const hardBlockers = blockers.filter((b) => b.severity === "error");
  if (hardBlockers.length > 0) {
    return Response.json(
      {
        blocked: true,
        gate: "B2",
        blockers,
      },
      { status: 422 },
    );
  }

  // Auto-Essential: alle mit priorityRanking <= 3 aber noch nicht isEssential
  const autoEssentialImpacts = await db
    .select({ id: biaProcessImpact.id, processId: biaProcessImpact.processId })
    .from(biaProcessImpact)
    .where(
      and(
        eq(biaProcessImpact.biaAssessmentId, id),
        lte(biaProcessImpact.priorityRanking, 3),
        eq(biaProcessImpact.isEssential, false),
        sql`${biaProcessImpact.priorityRanking} IS NOT NULL`,
      ),
    );

  let autoEssentialCount = 0;
  const newEssentialIds = autoEssentialImpacts.map((i) => i.id);

  if (newEssentialIds.length > 0) {
    await withAuditContext(ctx, async (tx) => {
      await tx
        .update(biaProcessImpact)
        .set({ isEssential: true, updatedAt: new Date() })
        .where(inArray(biaProcessImpact.id, newEssentialIds));
      autoEssentialCount = newEssentialIds.length;
    });
  }

  // Essential-Process-Records erzeugen (wenn noch nicht vorhanden)
  const allEssentialImpacts = await db
    .select({
      processId: biaProcessImpact.processId,
      priorityRanking: biaProcessImpact.priorityRanking,
      mtpdHours: biaProcessImpact.mtpdHours,
      rtoHours: biaProcessImpact.rtoHours,
      rpoHours: biaProcessImpact.rpoHours,
    })
    .from(biaProcessImpact)
    .where(
      and(
        eq(biaProcessImpact.biaAssessmentId, id),
        eq(biaProcessImpact.isEssential, true),
      ),
    );

  const existingEssentials = await db
    .select({ processId: essentialProcess.processId })
    .from(essentialProcess)
    .where(eq(essentialProcess.orgId, ctx.orgId));
  const existingProcessSet = new Set(existingEssentials.map((e) => e.processId));

  const newEssentialProcesses = allEssentialImpacts.filter(
    (i) => !existingProcessSet.has(i.processId),
  );

  let essentialsCreated = 0;
  if (newEssentialProcesses.length > 0) {
    await withAuditContext(ctx, async (tx) => {
      await tx.insert(essentialProcess).values(
        newEssentialProcesses.map((i) => ({
          orgId: ctx.orgId,
          processId: i.processId,
          biaAssessmentId: id,
          priorityRanking: i.priorityRanking ?? 99,
        })),
      );
      essentialsCreated = newEssentialProcesses.length;
    });
  }

  // Transition auf 'review'
  const [updated] = await withAuditContext(ctx, async (tx) => {
    return tx
      .update(biaAssessment)
      .set({
        status: "review",
        updatedAt: new Date(),
      })
      .where(and(eq(biaAssessment.id, id), eq(biaAssessment.orgId, ctx.orgId)))
      .returning();
  });

  return Response.json({
    data: {
      biaAssessmentId: updated.id,
      status: updated.status,
      previousStatus: "in_progress",
      autoMarkedEssential: autoEssentialCount,
      essentialProcessesCreated: essentialsCreated,
      coverageStats,
      blockers, // Warnings falls vorhanden
      nextSteps: [
        {
          step: "approve",
          label: "BCM-Manager-Approval einholen + Transition nach 'approved'",
        },
        {
          step: "design_continuity_strategies",
          label: "Continuity-Strategies pro essential-process designen",
          endpoint: "/api/v1/bcms/strategies",
        },
      ],
    },
  });
}
