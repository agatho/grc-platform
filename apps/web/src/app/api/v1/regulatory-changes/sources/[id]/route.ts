import { db, regulatorySource } from "@grc/db";
import { updateRegulatorySourceSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/regulatory-changes/sources/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const [source] = await db
    .select()
    .from(regulatorySource)
    .where(eq(regulatorySource.id, id));

  if (!source) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: source });
}

// PATCH /api/v1/regulatory-changes/sources/:id
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = updateRegulatorySourceSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(regulatorySource)
      .set({ ...body.data, updatedAt: new Date() })
      .where(
        and(eq(regulatorySource.id, id), eq(regulatorySource.orgId, ctx.orgId)),
      )
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}

// DELETE /api/v1/regulatory-changes/sources/:id
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(regulatorySource)
      .where(
        and(eq(regulatorySource.id, id), eq(regulatorySource.orgId, ctx.orgId)),
      )
      .returning();
    return deleted;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id } });
}
