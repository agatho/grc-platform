import { db, reportTemplate } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateReportTemplateSchema } from "@grc/shared";

// GET /api/v1/reports/templates/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const rows = await db
    .select()
    .from(reportTemplate)
    .where(and(eq(reportTemplate.id, id), eq(reportTemplate.orgId, ctx.orgId)))
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  return Response.json({ data: rows[0] });
}

// PUT /api/v1/reports/templates/[id]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = updateReportTemplateSchema.parse(await req.json());

  // Prevent editing default templates directly
  const [existing] = await db
    .select()
    .from(reportTemplate)
    .where(and(eq(reportTemplate.id, id), eq(reportTemplate.orgId, ctx.orgId)))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  if (existing.isDefault) {
    return Response.json(
      { error: "Default templates cannot be edited. Create a copy instead." },
      { status: 403 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(reportTemplate)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(
        and(eq(reportTemplate.id, id), eq(reportTemplate.orgId, ctx.orgId)),
      )
      .returning();
    return updated;
  });

  return Response.json({ data: result });
}

// DELETE /api/v1/reports/templates/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(reportTemplate)
    .where(and(eq(reportTemplate.id, id), eq(reportTemplate.orgId, ctx.orgId)))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  if (existing.isDefault) {
    return Response.json(
      { error: "Default templates cannot be deleted" },
      { status: 403 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(reportTemplate)
      .where(
        and(eq(reportTemplate.id, id), eq(reportTemplate.orgId, ctx.orgId)),
      );
  });

  return Response.json({ success: true });
}
