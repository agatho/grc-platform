import { db, taxCmsElement } from "@grc/db";
import { updateTaxCmsElementSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db.select().from(taxCmsElement).where(and(eq(taxCmsElement.id, id), eq(taxCmsElement.orgId, ctx.orgId)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateTaxCmsElementSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(taxCmsElement).set({ ...body.data, updatedAt: new Date() }).where(and(eq(taxCmsElement.id, id), eq(taxCmsElement.orgId, ctx.orgId))).returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
