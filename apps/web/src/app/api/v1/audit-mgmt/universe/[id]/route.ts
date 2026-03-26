import { db, auditUniverseEntry } from "@grc/db";
import { updateAuditUniverseEntrySchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/audit-mgmt/universe/[id]
export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, _req.method);
  if (moduleCheck) return moduleCheck;

  const [entry] = await db
    .select()
    .from(auditUniverseEntry)
    .where(
      and(
        eq(auditUniverseEntry.id, id),
        eq(auditUniverseEntry.orgId, ctx.orgId),
        isNull(auditUniverseEntry.deletedAt),
      ),
    );

  if (!entry) {
    return Response.json({ error: "Universe entry not found" }, { status: 404 });
  }

  return Response.json({ data: entry });
}

// PUT /api/v1/audit-mgmt/universe/[id]
export async function PUT(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = updateAuditUniverseEntrySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(auditUniverseEntry)
      .set({
        ...body.data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(auditUniverseEntry.id, id),
          eq(auditUniverseEntry.orgId, ctx.orgId),
          isNull(auditUniverseEntry.deletedAt),
        ),
      )
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Universe entry not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/audit-mgmt/universe/[id]
export async function DELETE(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(auditUniverseEntry)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(auditUniverseEntry.id, id),
          eq(auditUniverseEntry.orgId, ctx.orgId),
          isNull(auditUniverseEntry.deletedAt),
        ),
      )
      .returning();
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Universe entry not found" }, { status: 404 });
  }

  return Response.json({ data: { id } });
}
