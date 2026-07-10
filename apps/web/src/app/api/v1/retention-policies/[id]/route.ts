import { db, retentionPolicy, document } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateRetentionPolicySchema } from "@grc/shared";
import { eq, and, isNull, count } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/retention-policies/:id — Retention policy detail (D3)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select()
    .from(retentionPolicy)
    .where(
      and(
        eq(retentionPolicy.id, id),
        eq(retentionPolicy.orgId, ctx.orgId),
        isNull(retentionPolicy.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PUT /api/v1/retention-policies/:id — Update retention policy (admin only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = updateRetentionPolicySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(retentionPolicy)
      .set({
        ...(body.data.name !== undefined ? { name: body.data.name } : {}),
        ...(body.data.description !== undefined
          ? { description: body.data.description }
          : {}),
        ...(body.data.retentionYears !== undefined
          ? { retentionYears: body.data.retentionYears }
          : {}),
        ...(body.data.basis !== undefined ? { basis: body.data.basis } : {}),
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(retentionPolicy.id, id),
          eq(retentionPolicy.orgId, ctx.orgId),
          isNull(retentionPolicy.deletedAt),
        ),
      )
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/retention-policies/:id — Soft delete (admin only).
// Refused while documents still reference the policy.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [{ value: inUse }] = await db
    .select({ value: count() })
    .from(document)
    .where(
      and(
        eq(document.retentionPolicyId, id),
        eq(document.orgId, ctx.orgId),
        isNull(document.deletedAt),
      ),
    );

  if (inUse > 0) {
    return Response.json(
      {
        error: `Retention policy is assigned to ${inUse} document(s) and cannot be deleted`,
      },
      { status: 422 },
    );
  }

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(retentionPolicy)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(retentionPolicy.id, id),
          eq(retentionPolicy.orgId, ctx.orgId),
          isNull(retentionPolicy.deletedAt),
        ),
      )
      .returning({ id: retentionPolicy.id });
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: { id, deleted: true } });
}
