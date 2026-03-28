import { db, reportSchedule, reportTemplate } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createReportScheduleSchema,
  listReportSchedulesQuerySchema,
} from "@grc/shared";

/**
 * Simple cron next-run calculator.
 * Supports basic patterns: minute hour dayOfMonth month dayOfWeek
 */
function computeNextRun(cronExpression: string): Date {
  // Simplified: compute next occurrence
  // For production, use a library like cron-parser
  const now = new Date();
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5) {
    // Default to 1 hour from now
    return new Date(now.getTime() + 3600000);
  }

  const minute = parts[0] === "*" ? 0 : parseInt(parts[0], 10);
  const hour = parts[1] === "*" ? now.getHours() + 1 : parseInt(parts[1], 10);
  const dayOfMonth = parts[2] === "*" ? now.getDate() : parseInt(parts[2], 10);
  const month = parts[3] === "*" ? now.getMonth() : parseInt(parts[3], 10) - 1;

  const next = new Date(now.getFullYear(), month, dayOfMonth, hour, minute, 0);
  if (next <= now) {
    // Move to next month
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

// GET /api/v1/reports/schedules — List schedules
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listReportSchedulesQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );

  const conditions = [eq(reportSchedule.orgId, ctx.orgId)];

  if (query.templateId) {
    conditions.push(eq(reportSchedule.templateId, query.templateId));
  }
  if (query.isActive !== undefined) {
    conditions.push(eq(reportSchedule.isActive, query.isActive));
  }

  const offset = (query.page - 1) * query.limit;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: reportSchedule.id,
        templateId: reportSchedule.templateId,
        templateName: reportTemplate.name,
        name: reportSchedule.name,
        cronExpression: reportSchedule.cronExpression,
        recipientEmails: reportSchedule.recipientEmails,
        outputFormat: reportSchedule.outputFormat,
        isActive: reportSchedule.isActive,
        lastRunAt: reportSchedule.lastRunAt,
        nextRunAt: reportSchedule.nextRunAt,
        createdBy: reportSchedule.createdBy,
        createdAt: reportSchedule.createdAt,
      })
      .from(reportSchedule)
      .leftJoin(
        reportTemplate,
        eq(reportSchedule.templateId, reportTemplate.id),
      )
      .where(and(...conditions))
      .orderBy(desc(reportSchedule.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(reportSchedule)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
}

// POST /api/v1/reports/schedules — Create schedule
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createReportScheduleSchema.parse(await req.json());

  // Verify template exists
  const [template] = await db
    .select()
    .from(reportTemplate)
    .where(
      and(
        eq(reportTemplate.id, body.templateId),
        eq(reportTemplate.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!template) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  const nextRunAt = computeNextRun(body.cronExpression);

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(reportSchedule)
      .values({
        orgId: ctx.orgId,
        templateId: body.templateId,
        name: body.name,
        cronExpression: body.cronExpression,
        parametersJson: body.parametersJson,
        recipientEmails: body.recipientEmails,
        outputFormat: body.outputFormat,
        isActive: body.isActive,
        nextRunAt,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
