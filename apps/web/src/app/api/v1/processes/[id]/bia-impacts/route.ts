// BPM Overhaul Phase 4: List all BIA impact records that score this process.

import { db, process, biaAssessment, biaProcessImpact } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(
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
}
