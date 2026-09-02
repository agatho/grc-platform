import { db, reportSchedule } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateReportScheduleSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/reports/schedules/[id]
export const GET = withErrorHandler(async function GET(
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
    .from(reportSchedule)
    .where(and(eq(reportSchedule.id, id), eq(reportSchedule.orgId, ctx.orgId)))
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Schedule not found" }, { status: 404 });
  }

  return Response.json({ data: rows[0] });
});
// PUT /api/v1/reports/schedules/[id]
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = updateReportScheduleSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(reportSchedule)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(
        and(eq(reportSchedule.id, id), eq(reportSchedule.orgId, ctx.orgId)),
      )
      .returning();
    return updated;
  });

  if (!result) {
    return Response.json({ error: "Schedule not found" }, { status: 404 });
  }

  return Response.json({ data: result });
});
// DELETE /api/v1/reports/schedules/[id]
export const DELETE = withErrorHandler(async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  await withAuditContext(ctx, async (tx) => {
    await tx
      .delete(reportSchedule)
      .where(
        and(eq(reportSchedule.id, id), eq(reportSchedule.orgId, ctx.orgId)),
      );
  });

  return Response.json({ success: true });
});
