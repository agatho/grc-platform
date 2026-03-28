import { db, incidentCorrelation } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/isms/incidents/correlations — List detected correlations
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const typeFilter = searchParams.get("correlationType");

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
