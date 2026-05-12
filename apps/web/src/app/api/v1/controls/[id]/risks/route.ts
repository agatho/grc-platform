// #WAVE6-CROSS-02: which risks does this control mitigate?
// Joins risk_control + risk. Reverse direction of /risks/{id}/controls.

import { db, risk, riskControl } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  requireUuidParam(id);

  const rows = await db
    .select({
      id: risk.id,
      title: risk.title,
      riskCategory: risk.riskCategory,
      status: risk.status,
      ownerId: risk.ownerId,
      riskScoreInherent: risk.riskScoreInherent,
      riskScoreResidual: risk.riskScoreResidual,
      linkedAt: riskControl.createdAt,
    })
    .from(riskControl)
    .innerJoin(risk, eq(riskControl.riskId, risk.id))
    .where(
      and(
        eq(riskControl.orgId, ctx.orgId),
        eq(riskControl.controlId, id),
        isNull(risk.deletedAt),
      ),
    )
    .orderBy(desc(riskControl.createdAt));

  return Response.json({ data: rows, total: rows.length });
});
