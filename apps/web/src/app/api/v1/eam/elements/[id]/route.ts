import { db, architectureElement, architectureRelationship } from "@grc/db";
import { updateArchitectureElementSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, or } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/eam/elements/:id — Element detail + relationships
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const [element] = await db
    .select()
    .from(architectureElement)
    .where(and(eq(architectureElement.id, id), eq(architectureElement.orgId, ctx.orgId)));

  if (!element) {
    return Response.json({ error: "Element not found" }, { status: 404 });
  }

  const relationships = await db
    .select()
    .from(architectureRelationship)
    .where(
      and(
        eq(architectureRelationship.orgId, ctx.orgId),
        or(
          eq(architectureRelationship.sourceId, id),
          eq(architectureRelationship.targetId, id),
        ),
      ),
    );

  return Response.json({ data: { ...element, relationships } });
}

// PUT /api/v1/eam/elements/:id
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = updateArchitectureElementSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(architectureElement)
      .set({ ...body.data, updatedAt: new Date() })
      .where(and(eq(architectureElement.id, id), eq(architectureElement.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  if (!result) {
    return Response.json({ error: "Element not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}

// DELETE /api/v1/eam/elements/:id
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(architectureElement)
      .where(and(eq(architectureElement.id, id), eq(architectureElement.orgId, ctx.orgId)))
      .returning({ id: architectureElement.id });
    return deleted;
  });

  if (!result) {
    return Response.json({ error: "Element not found" }, { status: 404 });
  }

  return Response.json({ data: { deleted: true } });
}
