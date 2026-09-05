import { db, securityIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import { updateIncidentSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { emitEntityDeleted, emitEntityUpdated } from "@/lib/entity-events";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/incidents/[id]
export const GET = withErrorHandler(async function GET(
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
});
// PUT /api/v1/isms/incidents/[id]
export const PUT = withErrorHandler(async function PUT(
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
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    // If toggling data breach on, compute 72h deadline
    let dataBreachDeadline: Date | null | undefined;
    if (data.isDataBreach === true) {
      const [existing] = await tx
        .select({
          detectedAt: securityIncident.detectedAt,
          dataBreachDeadline: securityIncident.dataBreachDeadline,
        })
        .from(securityIncident)
        .where(eq(securityIncident.id, id))
        .limit(1);
      if (existing && !existing.dataBreachDeadline) {
        dataBreachDeadline = new Date(
          new Date(existing.detectedAt).getTime() + 72 * 60 * 60 * 1000,
        );
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

  // Webhook fan-out (best-effort, after commit — never fails the request).
  // No full before-image is fetched on this path; consumers get the
  // updated row plus the submitted patch keys as changed fields.
  emitEntityUpdated({
    orgId: ctx.orgId,
    entityType: "incident",
    entityId: id,
    userId: ctx.userId,
    before: {},
    after: result,
  });

  return Response.json({ data: result });
});
// DELETE /api/v1/isms/incidents/[id] (soft delete)
export const DELETE = withErrorHandler(async function DELETE(
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

  // Webhook fan-out (best-effort, after commit — never fails the request)
  emitEntityDeleted({
    orgId: ctx.orgId,
    entityType: "incident",
    entityId: id,
    userId: ctx.userId,
    data: { id },
  });

  return Response.json({ success: true });
});
