// #WAVE6-CROSS-02: which processes are exposed to this risk?
// Joins process_risk + process. process_risk.processId is not declared
// as a Drizzle FK (legacy decision; the migration SQL has the actual
// REFERENCES). Drizzle still lets us join via column equality.

import { db, process, processRisk } from "@grc/db";
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
      id: process.id,
      name: process.name,
      status: process.status,
      level: process.level,
      department: process.department,
      processOwnerId: process.processOwnerId,
      riskContext: processRisk.riskContext,
      linkedAt: processRisk.createdAt,
    })
    .from(processRisk)
    .innerJoin(process, eq(processRisk.processId, process.id))
    .where(
      and(
        eq(processRisk.orgId, ctx.orgId),
        eq(processRisk.riskId, id),
        isNull(process.deletedAt),
      ),
    )
    .orderBy(desc(processRisk.createdAt));

  return Response.json({ data: rows, total: rows.length });
});
