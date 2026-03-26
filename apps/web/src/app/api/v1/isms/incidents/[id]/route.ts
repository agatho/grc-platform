import { db, securityIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateIncidentSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/isms/incidents/[id]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const rows = await db
    .select()
    .from(securityIncident)
    .where(
      and(
        eq(securityIncident.id, id),
        eq(securityIncident.orgId, ctx.orgId),
        isNull(securityIncident.deletedAt),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  return Response.json({ data: rows[0] });
}

// PUT /api/v1/isms/incidents/[id]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();

  const parsed = updateIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    // If toggling data breach on, compute 72h deadline
    let dataBreachDeadline: Date | null | undefined;
    if (data.isDataBreach === true) {
      const [existing] = await tx
        .select({ detectedAt: securityIncident.detectedAt, dataBreachDeadline: securityIncident.dataBreachDeadline })
        .from(securityIncident)
        .where(eq(securityIncident.id, id))
        .limit(1);
      if (existing && !existing.dataBreachDeadline) {
        dataBreachDeadline = new Date(new Date(existing.detectedAt).getTime() + 72 * 60 * 60 * 1000);
      }
    } else if (data.isDataBreach === false) {
      dataBreachDeadline = null;
    }

    const setValues: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    };
    if (dataBreachDeadline !== undefined) {
      setValues.dataBreachDeadline = dataBreachDeadline;
    }

    const [updated] = await tx
      .update(securityIncident)
      .set(setValues)
      .where(
        and(
          eq(securityIncident.id, id),
          eq(securityIncident.orgId, ctx.orgId),
          isNull(securityIncident.deletedAt),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}

// DELETE /api/v1/isms/incidents/[id] (soft delete)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(securityIncident)
      .set({ deletedAt: new Date(), updatedBy: ctx.userId })
      .where(
        and(
          eq(securityIncident.id, id),
          eq(securityIncident.orgId, ctx.orgId),
          isNull(securityIncident.deletedAt),
        ),
      );
  });

  return Response.json({ success: true });
}
