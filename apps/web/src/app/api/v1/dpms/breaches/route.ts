import { db, dataBreach, workItem, notification, user } from "@grc/db";
import { createDataBreachSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import {
  eq,
  and,
  isNull,
  count,
  desc,
  asc,
  inArray,
  ilike,
  sql,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/dpms/breaches — Create breach with auto 72h deadline + auto work item
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createDataBreachSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const detectedAt = new Date(body.data.detectedAt);
  const deadline72h = new Date(detectedAt.getTime() + 72 * 60 * 60 * 1000);

  const created = await withAuditContext(ctx, async (tx) => {
    const [wi] = await tx
      .insert(workItem)
      .values({
        orgId: ctx.orgId,
        typeKey: "data_breach",
        name: body.data.title,
        status: "open",
        dueDate: deadline72h,
        grcPerspective: ["dpms"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    const [row] = await tx
      .insert(dataBreach)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        title: body.data.title,
        description: body.data.description,
        severity: body.data.severity,
        detectedAt,
        incidentId: body.data.incidentId,
        dataCategoriesAffected: body.data.dataCategoriesAffected,
        estimatedRecordsAffected: body.data.estimatedRecordsAffected,
        affectedCountries: body.data.affectedCountries,
        isDpaNotificationRequired: body.data.isDpaNotificationRequired,
        isIndividualNotificationRequired:
          body.data.isIndividualNotificationRequired,
        containmentMeasures: body.data.containmentMeasures,
        dpoId: body.data.dpoId,
        assigneeId: body.data.assigneeId,
        createdBy: ctx.userId,
      })
      .returning();

    // Notify DPO if assigned
    if (body.data.dpoId && body.data.dpoId !== ctx.userId) {
      await tx.insert(notification).values({
        userId: body.data.dpoId,
        orgId: ctx.orgId,
        type: "task_assigned" as const,
        entityType: "data_breach",
        entityId: row.id,
        title: `Data breach reported: ${body.data.title}`,
        message: `A data breach has been detected. 72h notification deadline: ${deadline72h.toISOString()}`,
        channel: "both" as const,
        templateKey: "breach_dpo_notification",
        templateData: {
          breachTitle: body.data.title,
          severity: body.data.severity,
          deadline72h: deadline72h.toISOString(),
        },
        createdBy: ctx.userId,
      });
    }

    return { ...row, elementId: wi.elementId };
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/dpms/breaches — List breaches
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(dataBreach.orgId, ctx.orgId),
    isNull(dataBreach.deletedAt),
  ];

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      | "detected"
      | "assessing"
      | "notifying_dpa"
      | "notifying_individuals"
      | "remediation"
      | "closed"
    >;
    conditions.push(inArray(dataBreach.status, statuses));
  }

  const severityParam = searchParams.get("severity");
  if (severityParam) {
    const severities = severityParam.split(",") as Array<
      "low" | "medium" | "high" | "critical"
    >;
    conditions.push(inArray(dataBreach.severity, severities));
  }

  const search = searchParams.get("search");
  if (search) {
    conditions.push(ilike(dataBreach.title, `%${search}%`));
  }

  const where = and(...conditions);

  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;
  const sortParam = searchParams.get("sort");
  let orderBy;
  switch (sortParam) {
    case "title":
      orderBy = sortDir(dataBreach.title);
      break;
    case "severity":
      orderBy = sortDir(dataBreach.severity);
      break;
    case "status":
      orderBy = sortDir(dataBreach.status);
      break;
    default:
      orderBy = desc(dataBreach.detectedAt);
  }

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: dataBreach.id,
        orgId: dataBreach.orgId,
        workItemId: dataBreach.workItemId,
        title: dataBreach.title,
        description: dataBreach.description,
        severity: dataBreach.severity,
        status: dataBreach.status,
        detectedAt: dataBreach.detectedAt,
        dpaNotifiedAt: dataBreach.dpaNotifiedAt,
        isDpaNotificationRequired: dataBreach.isDpaNotificationRequired,
        isIndividualNotificationRequired:
          dataBreach.isIndividualNotificationRequired,
        estimatedRecordsAffected: dataBreach.estimatedRecordsAffected,
        affectedCountries: dataBreach.affectedCountries,
        assigneeId: dataBreach.assigneeId,
        assigneeName: user.name,
        createdAt: dataBreach.createdAt,
        updatedAt: dataBreach.updatedAt,
      })
      .from(dataBreach)
      .leftJoin(user, eq(dataBreach.assigneeId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(dataBreach).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
