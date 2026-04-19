// POST /api/v1/cross/risk-sync
//
// Epic 6.2: Synchronisiert DPIA-Risks + FRIA-Rights + AI-Incidents in das
// Enterprise Risk Register (risk). Idempotent via (catalogSource, catalogEntryId).
//
// Body: { minScore?: number, dryRun?: boolean }

import { db, risk, dpiaRisk, aiFria, aiIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  buildSyncBatch,
  type DpiaRiskSource,
  type FriaRightSource,
  type AiIncidentSource,
  type SyncedRiskDraft,
} from "@grc/shared";
import { and, eq } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const bodySchema = z.object({
  minScore: z.number().int().min(1).max(25).default(6),
  dryRun: z.boolean().default(false),
});

interface FriaRightEntry {
  right: string;
  impact: "high" | "medium" | "low" | "negligible";
  mitigation: string;
  residualRisk: "high" | "medium" | "low" | "negligible";
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // ─── Source-Collection ────────────────────────────────────
  const dpiaRisks = (
    await db
      .select({
        id: dpiaRisk.id,
        orgId: dpiaRisk.orgId,
        dpiaId: dpiaRisk.dpiaId,
        riskDescription: dpiaRisk.riskDescription,
        severity: dpiaRisk.severity,
        likelihood: dpiaRisk.likelihood,
        impact: dpiaRisk.impact,
      })
      .from(dpiaRisk)
      .where(eq(dpiaRisk.orgId, ctx.orgId))
  ) as DpiaRiskSource[];

  const friaRows = await db
    .select({
      id: aiFria.id,
      orgId: aiFria.orgId,
      rightsAssessed: aiFria.rightsAssessed,
    })
    .from(aiFria)
    .where(eq(aiFria.orgId, ctx.orgId));

  const friaRights: FriaRightSource[] = [];
  for (const f of friaRows) {
    const arr = (f.rightsAssessed ?? []) as unknown[];
    for (const entry of arr) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        "right" in entry &&
        "impact" in entry &&
        "residualRisk" in entry
      ) {
        const e = entry as FriaRightEntry;
        friaRights.push({
          friaId: f.id,
          orgId: f.orgId,
          right: e.right,
          impact: e.impact,
          residualRisk: e.residualRisk,
          mitigation: e.mitigation ?? "",
        });
      }
    }
  }

  const aiIncidents = (
    await db
      .select({
        id: aiIncident.id,
        orgId: aiIncident.orgId,
        aiSystemId: aiIncident.aiSystemId,
        title: aiIncident.title,
        severity: aiIncident.severity,
        isSerious: aiIncident.isSerious,
        harmType: aiIncident.harmType,
        affectedPersonsCount: aiIncident.affectedPersonsCount,
      })
      .from(aiIncident)
      .where(eq(aiIncident.orgId, ctx.orgId))
  ) as AiIncidentSource[];

  const batch = buildSyncBatch({
    dpiaRisks,
    friaRights,
    aiIncidents,
    minScore: parsed.data.minScore,
  });

  if (parsed.data.dryRun) {
    return Response.json({
      data: {
        dryRun: true,
        totalCandidates: batch.totalCandidates,
        eligibleForSync: batch.eligibleForSync,
        filteredByThreshold: batch.filteredByThreshold,
        drafts: batch.drafts,
        skipped: batch.skipped,
      },
    });
  }

  // ─── Upsert (idempotent via catalogSource + catalogEntryId) ──
  const upserts: Array<{ id: string; action: "created" | "updated"; draft: SyncedRiskDraft }> = [];

  await withAuditContext(ctx, async (tx) => {
    for (const draft of batch.drafts) {
      const existing = await tx
        .select({ id: risk.id })
        .from(risk)
        .where(
          and(
            eq(risk.orgId, ctx.orgId),
            eq(risk.catalogSource, draft.catalogSource),
            eq(risk.catalogEntryId, draft.catalogEntryId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(risk)
          .set({
            title: draft.title,
            description: draft.description,
            inherentLikelihood: draft.inherentLikelihood,
            inherentImpact: draft.inherentImpact,
            riskScoreInherent: draft.riskScoreInherent,
            updatedAt: new Date(),
            updatedBy: ctx.userId,
          })
          .where(eq(risk.id, existing[0].id));
        upserts.push({ id: existing[0].id, action: "updated", draft });
      } else {
        const [inserted] = await tx
          .insert(risk)
          .values({
            orgId: ctx.orgId,
            title: draft.title,
            description: draft.description,
            riskCategory: draft.riskCategory,
            riskSource: draft.riskSource,
            status: "identified",
            inherentLikelihood: draft.inherentLikelihood,
            inherentImpact: draft.inherentImpact,
            riskScoreInherent: draft.riskScoreInherent,
            catalogSource: draft.catalogSource,
            catalogEntryId: draft.catalogEntryId,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })
          .returning({ id: risk.id });
        upserts.push({ id: inserted.id, action: "created", draft });
      }
    }
  });

  const createdCount = upserts.filter((u) => u.action === "created").length;
  const updatedCount = upserts.filter((u) => u.action === "updated").length;

  return Response.json({
    data: {
      dryRun: false,
      totalCandidates: batch.totalCandidates,
      eligibleForSync: batch.eligibleForSync,
      filteredByThreshold: batch.filteredByThreshold,
      createdCount,
      updatedCount,
      skipped: batch.skipped,
      syncedRisks: upserts.map((u) => ({
        riskId: u.id,
        action: u.action,
        catalogSource: u.draft.catalogSource,
        catalogEntryId: u.draft.catalogEntryId,
        riskScoreInherent: u.draft.riskScoreInherent,
      })),
    },
  });
}
