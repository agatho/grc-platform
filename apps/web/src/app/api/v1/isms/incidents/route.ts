import {
  db,
  securityIncident,
  incidentSeverityEnum,
  incidentStatusEnum,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { createIncidentSchema } from "@grc/shared";
import {
  parseQueryParams,
  searchQueryParam,
  booleanQueryParam,
} from "@/lib/query-schema";
import { eq, and, isNull, ilike, sql } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { emitEntityCreated } from "@/lib/entity-events";
import { z } from "zod";

// #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
// against a schema instead of being read as `string | null` and cast
// with `as <enum>`. An unknown filter value used to reach Postgres and
// surface as a 500 (`invalid input value for enum …`); it is a 422 now,
// and free-text search terms are length-bounded.
const incidentListQuerySchema = z.object({
  severity: z.enum(incidentSeverityEnum.enumValues).optional(),
  status: z.enum(incidentStatusEnum.enumValues).optional(),
  search: searchQueryParam,
  breachOnly: booleanQueryParam,
});

// GET /api/v1/isms/incidents
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const q = parseQueryParams(incidentListQuerySchema, searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const severityFilter = q.data.severity ?? null;
  const statusFilter = q.data.status ?? null;
  const search = q.data.search ?? null;
  const breachOnly = q.data.breachOnly === true ? "true" : null;

  const conditions = [
    eq(securityIncident.orgId, ctx.orgId),
    isNull(securityIncident.deletedAt),
  ];
  if (severityFilter) {
    conditions.push(
      eq(
        securityIncident.severity,
        severityFilter as "low" | "medium" | "high" | "critical",
      ),
    );
  }
  if (statusFilter) {
    conditions.push(
      eq(
        securityIncident.status,
        statusFilter as
          | "detected"
          | "triaged"
          | "contained"
          | "eradicated"
          | "recovered"
          | "lessons_learned"
          | "closed",
      ),
    );
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
});

// POST /api/v1/isms/incidents
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
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

  // Webhook fan-out (best-effort, after commit — never fails the request)
  emitEntityCreated({
    orgId: ctx.orgId,
    entityType: "incident",
    entityId: result.id,
    userId: ctx.userId,
    data: result,
  });

  return Response.json({ data: result }, { status: 201 });
}
