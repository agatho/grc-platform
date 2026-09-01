import { db, threat } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createThreatSchema } from "@grc/shared";
import { parseQueryParams, searchQueryParam } from "@/lib/query-schema";
import { eq, and, ilike } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { z } from "zod";

// #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
// against a schema instead of being read as `string | null` and cast
// with `as <enum>`. An unknown filter value used to reach Postgres and
// surface as a 500 (`invalid input value for enum …`); it is a 422 now,
// and free-text search terms are length-bounded.
const threatListQuerySchema = z.object({
  // threat_category is a free-text column, not a pg enum — bound its shape
  // so a filter value cannot be an arbitrary blob.
  category: z.string().trim().min(1).max(100).optional(),
  search: searchQueryParam,
});

// GET /api/v1/isms/threats
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const q = parseQueryParams(threatListQuerySchema, searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const categoryFilter = q.data.category ?? null;
  const search = q.data.search ?? null;

  const conditions = [eq(threat.orgId, ctx.orgId)];
  if (categoryFilter) {
    conditions.push(eq(threat.threatCategory, categoryFilter));
  }
  if (search) {
    conditions.push(ilike(threat.title, `%${search}%`));
  }

  const rows = await db
    .select()
    .from(threat)
    .where(and(...conditions))
    .orderBy(threat.createdAt)
    .limit(limit)
    .offset(offset);

  const allRows = await db
    .select({ id: threat.id })
    .from(threat)
    .where(and(...conditions));

  return paginatedResponse(rows, allRows.length, page, limit);
});

// POST /api/v1/isms/threats
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createThreatSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(threat)
      .values({
        orgId: ctx.orgId,
        title: data.title,
        description: data.description ?? null,
        threatCategory: data.threatCategory ?? null,
        likelihoodRating: data.likelihoodRating ?? null,
        catalogEntryId: data.catalogEntryId ?? null,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
