import { db, aiSystem } from "@grc/db";
import { updateAiSystemSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "dpo",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db
    .select()
    .from(aiSystem)
    .where(
      and(
        eq(aiSystem.id, id),
        eq(aiSystem.orgId, ctx.orgId),
        isNull(aiSystem.deletedAt),
      ),
    );
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateAiSystemSchema.safeParse(await req.json());
  if (!body.success)
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(aiSystem)
      .set({ ...body.data, updatedAt: new Date() })
      .where(and(eq(aiSystem.id, id), eq(aiSystem.orgId, ctx.orgId)))
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
      .update(aiSystem)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(aiSystem.id, id), eq(aiSystem.orgId, ctx.orgId)))
      .returning();
    return deleted;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id } });
}
