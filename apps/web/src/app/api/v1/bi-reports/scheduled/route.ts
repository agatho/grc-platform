import { db, biScheduledReport, biReport } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createBiScheduledReportSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/bi-reports/scheduled
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const rows = await db
    .select()
    .from(biScheduledReport)
    .where(eq(biScheduledReport.orgId, ctx.orgId))
    .orderBy(desc(biScheduledReport.createdAt));

  return Response.json({ data: rows });
});
// POST /api/v1/bi-reports/scheduled
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createBiScheduledReportSchema.parse(await req.json());

  const [report] = await db
    .select({ id: biReport.id })
    .from(biReport)
    .where(and(eq(biReport.id, body.reportId), eq(biReport.orgId, ctx.orgId)));
  if (!report)
    return Response.json({ error: "Report not found" }, { status: 404 });

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(biScheduledReport)
      .values({
        orgId: ctx.orgId,
        reportId: body.reportId,
        name: body.name,
        frequency: body.frequency,
        cronExpression: body.cronExpression,
        outputFormat: body.outputFormat,
        recipientEmails: body.recipientEmails,
        parametersJson: body.parametersJson,
        isActive: body.isActive,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
