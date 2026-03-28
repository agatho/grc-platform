import { db, identityConnectorConfig } from "@grc/db";
import { updateIdentityConnectorConfigSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/identity-connectors/configs/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const [row] = await db.select().from(identityConnectorConfig).where(and(eq(identityConnectorConfig.id, id), eq(identityConnectorConfig.orgId, ctx.orgId)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

// PATCH /api/v1/identity-connectors/configs/:id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const body = updateIdentityConnectorConfigSchema.safeParse(await req.json());
  if (!body.success) return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx.update(identityConnectorConfig).set({ ...body.data, updatedAt: new Date() }).where(and(eq(identityConnectorConfig.id, id), eq(identityConnectorConfig.orgId, ctx.orgId))).returning();
    return row;
  });
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: updated });
}
