import { db, aiFria } from "@grc/db";
import { updateAiFriaSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "dpo", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db.select().from(aiFria).where(and(eq(aiFria.id, id), eq(aiFria.orgId, ctx.orgId)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateAiFriaSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(aiFria).set({ ...body.data, updatedAt: new Date() }).where(and(eq(aiFria.id, id), eq(aiFria.orgId, ctx.orgId))).returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
