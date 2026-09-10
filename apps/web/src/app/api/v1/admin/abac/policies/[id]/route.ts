import { db, abacPolicy } from "@grc/db";
import { updateAbacPolicySchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/admin/abac/policies/:id
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const [policy] = await db
    .select()
    .from(abacPolicy)
    .where(and(eq(abacPolicy.id, id), eq(abacPolicy.orgId, ctx.orgId)));

  if (!policy) {
    return Response.json({ error: "Policy not found" }, { status: 404 });
  }

  return Response.json({ data: policy });
});
// PUT /api/v1/admin/abac/policies/:id
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = updateAbacPolicySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(abacPolicy)
      .set({ ...body.data, updatedAt: new Date() })
      .where(and(eq(abacPolicy.id, id), eq(abacPolicy.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  if (!result) {
    return Response.json({ error: "Policy not found" }, { status: 404 });
  }

  return Response.json({ data: result });
});
// DELETE /api/v1/admin/abac/policies/:id
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(abacPolicy)
      .where(and(eq(abacPolicy.id, id), eq(abacPolicy.orgId, ctx.orgId)))
      .returning({ id: abacPolicy.id });
    return deleted;
  });

  if (!result) {
    return Response.json({ error: "Policy not found" }, { status: 404 });
  }

  return Response.json({ data: { deleted: true } });
});
