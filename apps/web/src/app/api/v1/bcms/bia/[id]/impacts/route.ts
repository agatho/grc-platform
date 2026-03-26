import { db, biaProcessImpact, biaAssessment } from "@grc/db";
import { submitBiaProcessImpactSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// POST /api/v1/bcms/bia/[id]/impacts — Submit/upsert a process impact
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: biaId } = await params;

  const body = submitBiaProcessImpactSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify BIA exists
  const [bia] = await db
    .select({ id: biaAssessment.id })
    .from(biaAssessment)
    .where(and(eq(biaAssessment.id, biaId), eq(biaAssessment.orgId, ctx.orgId)));

  if (!bia) {
    return Response.json({ error: "BIA assessment not found" }, { status: 404 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Upsert: check if impact already exists for this process
    const [existing] = await tx
      .select({ id: biaProcessImpact.id })
      .from(biaProcessImpact)
      .where(
        and(
          eq(biaProcessImpact.biaAssessmentId, biaId),
          eq(biaProcessImpact.processId, body.data.processId),
        ),
      );

    const values = {
      orgId: ctx.orgId,
      biaAssessmentId: biaId,
      processId: body.data.processId,
      mtpdHours: body.data.mtpdHours,
      rtoHours: body.data.rtoHours,
      rpoHours: body.data.rpoHours,
      impact1h: body.data.impact1h?.toString(),
      impact4h: body.data.impact4h?.toString(),
      impact24h: body.data.impact24h?.toString(),
      impact72h: body.data.impact72h?.toString(),
      impact1w: body.data.impact1w?.toString(),
      impact1m: body.data.impact1m?.toString(),
      impactReputation: body.data.impactReputation,
      impactLegal: body.data.impactLegal,
      impactOperational: body.data.impactOperational,
      impactFinancial: body.data.impactFinancial,
      impactSafety: body.data.impactSafety,
      criticalResources: body.data.criticalResources,
      minimumStaff: body.data.minimumStaff,
      alternateLocation: body.data.alternateLocation,
      peakPeriods: body.data.peakPeriods,
      isEssential: body.data.isEssential,
      assessedBy: ctx.userId,
      assessedAt: new Date(),
      updatedAt: new Date(),
    };

    if (existing) {
      const [row] = await tx
        .update(biaProcessImpact)
        .set(values)
        .where(eq(biaProcessImpact.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await tx
      .insert(biaProcessImpact)
      .values(values)
      .returning();
    return row;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/bcms/bia/[id]/impacts — List process impacts for a BIA
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: biaId } = await params;
  const { page, limit, offset } = paginate(req);

  const where = and(
    eq(biaProcessImpact.biaAssessmentId, biaId),
    eq(biaProcessImpact.orgId, ctx.orgId),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(biaProcessImpact)
      .where(where)
      .orderBy(desc(biaProcessImpact.priorityRanking))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(biaProcessImpact).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
