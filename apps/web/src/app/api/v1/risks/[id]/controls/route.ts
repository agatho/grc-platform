// #WAVE6-CROSS-02: which controls mitigate this risk?
// Joins risk_control + control. Soft-deleted controls are filtered.

import { db, control, riskControl } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  requireUuidParam(id);

  const rows = await db
    .select({
      id: control.id,
      title: control.title,
      controlType: control.controlType,
      status: control.status,
      ownerId: control.ownerId,
      linkedAt: riskControl.createdAt,
    })
    .from(riskControl)
    .innerJoin(control, eq(riskControl.controlId, control.id))
    .where(
      and(
        eq(riskControl.orgId, ctx.orgId),
        eq(riskControl.riskId, id),
        isNull(control.deletedAt),
      ),
    )
    .orderBy(desc(riskControl.createdAt));

  return Response.json({ data: rows, total: rows.length });
});
