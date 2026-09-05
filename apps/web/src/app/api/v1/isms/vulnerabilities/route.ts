import { db, vulnerability } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createVulnerabilitySchema } from "@grc/shared";
import { parseQueryParams, searchQueryParam } from "@/lib/query-schema";
import { eq, and, isNull, ilike } from "drizzle-orm";
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
const vulnerabilityListQuerySchema = z.object({
  // severity/status are text columns here (not pg enums) — bound the shape.
  severity: z.string().trim().min(1).max(40).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  search: searchQueryParam,
});

// GET /api/v1/isms/vulnerabilities
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const q = parseQueryParams(vulnerabilityListQuerySchema, searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const severityFilter = q.data.severity ?? null;
  const statusFilter = q.data.status ?? null;
  const search = q.data.search ?? null;

  const conditions = [
    eq(vulnerability.orgId, ctx.orgId),
    isNull(vulnerability.deletedAt),
  ];
  if (severityFilter) {
    conditions.push(eq(vulnerability.severity, severityFilter));
  }
  if (statusFilter) {
    conditions.push(eq(vulnerability.status, statusFilter));
  }
  if (search) {
    conditions.push(ilike(vulnerability.title, `%${search}%`));
  }

  const rows = await db
    .select()
    .from(vulnerability)
    .where(and(...conditions))
    .orderBy(vulnerability.createdAt)
    .limit(limit)
    .offset(offset);

  const allRows = await db
    .select({ id: vulnerability.id })
    .from(vulnerability)
    .where(and(...conditions));

  return paginatedResponse(rows, allRows.length, page, limit);
});

// POST /api/v1/isms/vulnerabilities
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createVulnerabilitySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(vulnerability)
      .values({
        orgId: ctx.orgId,
        title: data.title,
        description: data.description ?? null,
        cveReference: data.cveReference ?? null,
        affectedAssetId: data.affectedAssetId ?? null,
        severity: data.severity,
        mitigationControlId: data.mitigationControlId ?? null,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
