import { db, riskAppetiteThreshold } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateRiskAppetiteThresholdSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/erm/risk-appetite/:id — Update threshold
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateRiskAppetiteThresholdSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(riskAppetiteThreshold)
      .set({
        ...parsed.data,
        maxResidualAle:
          parsed.data.maxResidualAle !== undefined
            ? parsed.data.maxResidualAle !== null
              ? String(parsed.data.maxResidualAle)
              : null
            : undefined,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(
        and(
          eq(riskAppetiteThreshold.id, id),
          eq(riskAppetiteThreshold.orgId, ctx.orgId),
        ),
      )
      .returning();

    if (!updated) {
      return null;
    }
    return updated;
  });

  if (!result) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}

// DELETE /api/v1/erm/risk-appetite/:id — Soft delete
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .update(riskAppetiteThreshold)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
      })
      .where(
        and(
          eq(riskAppetiteThreshold.id, id),
          eq(riskAppetiteThreshold.orgId, ctx.orgId),
        ),
      )
      .returning();
    return deleted;
  });

  if (!result) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
