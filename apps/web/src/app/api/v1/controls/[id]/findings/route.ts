// #WAVE6-CROSS-02: findings opened against this control.
// finding.controlId is a direct FK so no link table needed.

import { db, finding } from "@grc/db";
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
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      status: finding.status,
      source: finding.source,
      ownerId: finding.ownerId,
      remediationDueDate: finding.remediationDueDate,
      createdAt: finding.createdAt,
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        eq(finding.controlId, id),
        isNull(finding.deletedAt),
      ),
    )
    .orderBy(desc(finding.createdAt));

  return Response.json({ data: rows, total: rows.length });
});
