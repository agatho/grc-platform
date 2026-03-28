import { db, reportSchedule } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateReportScheduleSchema } from "@grc/shared";

// GET /api/v1/reports/schedules/[id]
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
    .from(reportSchedule)
    .where(
      and(eq(reportSchedule.id, id), eq(reportSchedule.orgId, ctx.orgId)),
    )
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Schedule not found" }, { status: 404 });
  }

  return Response.json({ data: rows[0] });
}

// PUT /api/v1/reports/schedules/[id]
export async function PUT(
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
}

// DELETE /api/v1/reports/schedules/[id]
export async function DELETE(
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
}
