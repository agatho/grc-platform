import { db, horizonImpactAssessment } from "@grc/db";
import { updateHorizonImpactSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "dpo",
    "risk_manager",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db
    .select()
    .from(horizonImpactAssessment)
    .where(
      and(
        eq(horizonImpactAssessment.id, id),
        eq(horizonImpactAssessment.orgId, ctx.orgId),
      ),
    );
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
});
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateHorizonImpactSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  const updateData: Record<string, unknown> = {
    ...body.data,
    updatedAt: new Date(),
  };
  if (body.data.status === "approved") {
    updateData.approvedBy = ctx.userId;
    updateData.approvedAt = new Date();
  }
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(horizonImpactAssessment)
      .set(updateData)
      .where(
        and(
          eq(horizonImpactAssessment.id, id),
          eq(horizonImpactAssessment.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
});
