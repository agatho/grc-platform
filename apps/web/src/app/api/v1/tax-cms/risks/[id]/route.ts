import { db, taxRisk } from "@grc/db";
import { updateTaxRiskSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db
    .select()
    .from(taxRisk)
    .where(
      and(
        eq(taxRisk.id, id),
        eq(taxRisk.orgId, ctx.orgId),
        isNull(taxRisk.deletedAt),
      ),
    );
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateTaxRiskSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(taxRisk)
      .set({ ...body.data, updatedAt: new Date() })
      .where(and(eq(taxRisk.id, id), eq(taxRisk.orgId, ctx.orgId)))
      .returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .update(taxRisk)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(taxRisk.id, id), eq(taxRisk.orgId, ctx.orgId)))
      .returning();
    return deleted;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id } });
}
