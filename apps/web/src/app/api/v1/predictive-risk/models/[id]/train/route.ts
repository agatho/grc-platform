import { db, riskPredictionModel } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/predictive-risk/models/:id/train — Train model
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const m = await requireModule("erm", ctx.orgId, req.method);
  if (m) return m;

  const { id } = await params;

  const [model] = await db
    .select()
    .from(riskPredictionModel)
    .where(
      and(
        eq(riskPredictionModel.id, id),
        eq(riskPredictionModel.orgId, ctx.orgId),
      ),
    );

  if (!model)
    return Response.json({ error: "Model not found" }, { status: 404 });

  if (model.status === "training") {
    return Response.json(
      { error: "Model is already training" },
      { status: 409 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(riskPredictionModel)
      .set({ status: "training", updatedAt: new Date() })
      .where(eq(riskPredictionModel.id, id))
      .returning();
    return updated;
  });

  // In production, this would enqueue a worker job for actual training
  return Response.json(
    { data: result, message: "Training queued" },
    { status: 202 },
  );
});
