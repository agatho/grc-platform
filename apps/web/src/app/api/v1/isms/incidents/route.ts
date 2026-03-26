import { db, securityIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createIncidentSchema } from "@grc/shared";
import { eq, and, isNull, ilike, sql } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/isms/incidents
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const severityFilter = searchParams.get("severity");
  const statusFilter = searchParams.get("status");
  const search = searchParams.get("search");
  const breachOnly = searchParams.get("breachOnly");

  const conditions = [
    eq(securityIncident.orgId, ctx.orgId),
    isNull(securityIncident.deletedAt),
  ];
  if (severityFilter) {
    conditions.push(eq(securityIncident.severity, severityFilter as "low" | "medium" | "high" | "critical"));
  }
  if (statusFilter) {
    conditions.push(eq(securityIncident.status, statusFilter as "detected" | "triaged" | "contained" | "eradicated" | "recovered" | "lessons_learned" | "closed"));
  }
  if (search) {
    conditions.push(ilike(securityIncident.title, `%${search}%`));
  }
  if (breachOnly === "true") {
    conditions.push(eq(securityIncident.isDataBreach, true));
  }

  const rows = await db
    .select()
    .from(securityIncident)
    .where(and(...conditions))
    .orderBy(securityIncident.detectedAt)
    .limit(limit)
    .offset(offset);

  const allRows = await db
    .select({ id: securityIncident.id })
    .from(securityIncident)
    .where(and(...conditions));

  return paginatedResponse(rows, allRows.length, page, limit);
}

// POST /api/v1/isms/incidents
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    // Generate element ID: INC + sequence
    const [{ count: incCount }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(securityIncident)
      .where(eq(securityIncident.orgId, ctx.orgId));

    const elementId = `INC${String(incCount + 1).padStart(8, "0")}`;
    const detectedAt = data.detectedAt ? new Date(data.detectedAt) : new Date();

    // Calculate 72h deadline if data breach
    const dataBreachDeadline = data.isDataBreach
      ? new Date(detectedAt.getTime() + 72 * 60 * 60 * 1000)
      : null;

    const [created] = await tx
      .insert(securityIncident)
      .values({
        orgId: ctx.orgId,
        elementId,
        title: data.title,
        description: data.description ?? null,
        severity: data.severity,
        incidentType: data.incidentType ?? null,
        detectedAt,
        reportedBy: ctx.userId,
        assignedTo: data.assignedTo ?? null,
        affectedAssetIds: data.affectedAssetIds,
        affectedProcessIds: data.affectedProcessIds,
        isDataBreach: data.isDataBreach,
        dataBreachDeadline,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
