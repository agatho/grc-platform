// #WAVE6-CROSS-02: control test runs (ToD/ToE) for this control.

import { db, controlTest } from "@grc/db";
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
      id: controlTest.id,
      campaignId: controlTest.campaignId,
      testType: controlTest.testType,
      status: controlTest.status,
      todResult: controlTest.todResult,
      toeResult: controlTest.toeResult,
      testerId: controlTest.testerId,
      testDate: controlTest.testDate,
      sampleSize: controlTest.sampleSize,
      conclusion: controlTest.conclusion,
      createdAt: controlTest.createdAt,
    })
    .from(controlTest)
    .where(
      and(
        eq(controlTest.orgId, ctx.orgId),
        eq(controlTest.controlId, id),
        isNull(controlTest.deletedAt),
      ),
    )
    .orderBy(desc(controlTest.testDate));

  return Response.json({ data: rows, total: rows.length });
});
