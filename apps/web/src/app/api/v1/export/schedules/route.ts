import { db, exportSchedule } from "@grc/db";
import { eq, desc, count } from "drizzle-orm";
import { createExportScheduleSchema } from "@grc/shared";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/export/schedules — Create scheduled export
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const body = createExportScheduleSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [schedule] = await withAuditContext(ctx, async (tx) => {
    return tx
      .insert(exportSchedule)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        entityTypes: body.data.entityTypes,
        format: body.data.format ?? "csv",
        cronExpression: body.data.cronExpression ?? "0 6 * * 1",
        recipientEmails: body.data.recipientEmails,
        filters: body.data.filters ?? {},
        createdBy: ctx.userId,
      })
      .returning();
  });

  return Response.json(schedule, { status: 201 });
});
// GET /api/v1/export/schedules — List scheduled exports
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const [totalResult] = await db
    .select({ total: count() })
    .from(exportSchedule)
    .where(eq(exportSchedule.orgId, ctx.orgId));

  const schedules = await db
    .select()
    .from(exportSchedule)
    .where(eq(exportSchedule.orgId, ctx.orgId))
    .orderBy(desc(exportSchedule.createdAt))
    .limit(limit)
    .offset(offset);

  return paginatedResponse(schedules, totalResult.total, page, limit);
});
