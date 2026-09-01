import { db, incidentCorrelation } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { z } from "zod";
import { parseQueryParams } from "@/lib/query-schema";

// #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
// against a schema instead of being read as `string | null` and cast
// with `as <enum>`. An unknown filter value used to reach Postgres and
// surface as a 500 (`invalid input value for enum …`); it is a 422 now,
// and free-text search terms are length-bounded.
const correlationQuerySchema = z.object({
  correlationType: z.string().trim().min(1).max(64).optional(),
});

// GET /api/v1/isms/incidents/correlations — List detected correlations
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const q = parseQueryParams(correlationQuerySchema, searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const typeFilter = q.data.correlationType ?? null;

  const conditions = [eq(incidentCorrelation.orgId, ctx.orgId)];
  if (typeFilter) {
    conditions.push(eq(incidentCorrelation.correlationType, typeFilter));
  }

  const rows = await db
    .select()
    .from(incidentCorrelation)
    .where(and(...conditions))
    .orderBy(desc(incidentCorrelation.confidence))
    .limit(limit)
    .offset(offset);

  const allRows = await db
    .select({ id: incidentCorrelation.id })
    .from(incidentCorrelation)
    .where(and(...conditions));

  return paginatedResponse(rows, allRows.length, page, limit);
}
