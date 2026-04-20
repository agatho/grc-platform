import { db, riskPredictionModel } from "@grc/db";
import { updatePredictionModelSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/predictive-risk/models/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

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

  if (!model) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: model });
}

// PATCH /api/v1/predictive-risk/models/:id
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = updatePredictionModelSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(riskPredictionModel)
      .set({ ...body.data, updatedAt: new Date() })
      .where(
        and(
          eq(riskPredictionModel.id, id),
          eq(riskPredictionModel.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}

// DELETE /api/v1/predictive-risk/models/:id
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(riskPredictionModel)
      .where(
        and(
          eq(riskPredictionModel.id, id),
          eq(riskPredictionModel.orgId, ctx.orgId),
        ),
      )
      .returning();
    return deleted;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id } });
}
