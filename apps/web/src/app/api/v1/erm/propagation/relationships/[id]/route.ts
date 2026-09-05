import { db, orgEntityRelationship } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateOrgRelationshipSchema } from "@grc/shared";
import { eq, and, or } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/erm/propagation/relationships/:id
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select()
    .from(orgEntityRelationship)
    .where(
      and(
        eq(orgEntityRelationship.id, id),
        or(
          eq(orgEntityRelationship.sourceOrgId, ctx.orgId),
          eq(orgEntityRelationship.targetOrgId, ctx.orgId),
        ),
      ),
    );

  if (!row) {
    return Response.json({ error: "Relationship not found" }, { status: 404 });
  }

  return Response.json({ data: row });
});
// PATCH /api/v1/erm/propagation/relationships/:id
export const PATCH = withErrorHandler(async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateOrgRelationshipSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(orgEntityRelationship)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orgEntityRelationship.id, id),
          eq(orgEntityRelationship.sourceOrgId, ctx.orgId),
        ),
      )
      .returning();

    return row;
  });

  if (!result) {
    return Response.json({ error: "Relationship not found" }, { status: 404 });
  }

  return Response.json({ data: result });
});
// DELETE /api/v1/erm/propagation/relationships/:id
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const result = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .delete(orgEntityRelationship)
      .where(
        and(
          eq(orgEntityRelationship.id, id),
          eq(orgEntityRelationship.sourceOrgId, ctx.orgId),
        ),
      )
      .returning();

    return row;
  });

  if (!result) {
    return Response.json({ error: "Relationship not found" }, { status: 404 });
  }

  return Response.json({ data: { deleted: true } });
});
