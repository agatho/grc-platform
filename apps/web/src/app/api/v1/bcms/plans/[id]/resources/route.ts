import { db, bcpResource, bcp } from "@grc/db";
import { createBcpResourceSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// POST /api/v1/bcms/plans/[id]/resources — Add resource
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: bcpId } = await params;

  const body = createBcpResourceSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify BCP exists
  const [plan] = await db
    .select({ id: bcp.id })
    .from(bcp)
    .where(and(eq(bcp.id, bcpId), eq(bcp.orgId, ctx.orgId), isNull(bcp.deletedAt)));

  if (!plan) {
    return Response.json({ error: "BCP not found" }, { status: 404 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(bcpResource)
      .values({
        bcpId,
        orgId: ctx.orgId,
        resourceType: body.data.resourceType,
        name: body.data.name,
        description: body.data.description,
        quantity: body.data.quantity,
        assetId: body.data.assetId,
        isAvailableOffsite: body.data.isAvailableOffsite,
        alternativeResource: body.data.alternativeResource,
        priority: body.data.priority,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/bcms/plans/[id]/resources — List resources
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: bcpId } = await params;
  const { page, limit, offset } = paginate(req);

  const where = and(
    eq(bcpResource.bcpId, bcpId),
    eq(bcpResource.orgId, ctx.orgId),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(bcpResource).where(where).limit(limit).offset(offset),
    db.select({ value: count() }).from(bcpResource).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
