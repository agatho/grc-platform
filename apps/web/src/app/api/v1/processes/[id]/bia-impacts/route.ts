// BPM Overhaul Phase 4: List all BIA impact records that score this process.

import { db, process, biaAssessment, biaProcessImpact } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
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

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  const impacts = await db
    .select({
      id: biaProcessImpact.id,
      biaAssessmentId: biaProcessImpact.biaAssessmentId,
      biaName: biaAssessment.name,
      biaStatus: biaAssessment.status,
      mtpdHours: biaProcessImpact.mtpdHours,
      rtoHours: biaProcessImpact.rtoHours,
      rpoHours: biaProcessImpact.rpoHours,
      impact24h: biaProcessImpact.impact24h,
      impact72h: biaProcessImpact.impact72h,
      impactReputation: biaProcessImpact.impactReputation,
      impactLegal: biaProcessImpact.impactLegal,
      impactOperational: biaProcessImpact.impactOperational,
      impactFinancial: biaProcessImpact.impactFinancial,
      impactSafety: biaProcessImpact.impactSafety,
      priorityRanking: biaProcessImpact.priorityRanking,
      isEssential: biaProcessImpact.isEssential,
      assessedAt: biaProcessImpact.assessedAt,
      updatedAt: biaProcessImpact.updatedAt,
    })
    .from(biaProcessImpact)
    .innerJoin(
      biaAssessment,
      eq(biaAssessment.id, biaProcessImpact.biaAssessmentId),
    )
    .where(
      and(
        eq(biaProcessImpact.processId, id),
        eq(biaProcessImpact.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(biaProcessImpact.updatedAt));

  return Response.json({ data: impacts });
});
