import { db, assessmentRun, assessmentStatusEnum } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createAssessmentRunSchema } from "@grc/shared";
import { parseQueryParams, searchQueryParam } from "@/lib/query-schema";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
// against a schema instead of being read as `string | null` and cast
// with `as <enum>`. An unknown filter value used to reach Postgres and
// surface as a 500 (`invalid input value for enum …`); it is a 422 now,
// and free-text search terms are length-bounded.
const assessmentListQuerySchema = z.object({
  status: z.enum(assessmentStatusEnum.enumValues).optional(),
  search: searchQueryParam,
});

// GET /api/v1/isms/assessments
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const q = parseQueryParams(assessmentListQuerySchema, searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const statusFilter = q.data.status ?? null;
  const search = q.data.search ?? null;

  const conditions: ReturnType<typeof eq>[] = [
    eq(assessmentRun.orgId, ctx.orgId),
  ];
  if (statusFilter) {
    conditions.push(
      eq(
        assessmentRun.status,
        statusFilter as
          "planning" | "in_progress" | "review" | "completed" | "cancelled",
      ),
    );
  }
  if (search) {
    conditions.push(ilike(assessmentRun.name, `%${search}%`));
  }

  const rows = await db
    .select()
    .from(assessmentRun)
    .where(and(...conditions))
    .orderBy(desc(assessmentRun.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(assessmentRun)
    .where(and(...conditions));

  return paginatedResponse(rows, total, page, limit);
});
// POST /api/v1/isms/assessments
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createAssessmentRunSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(assessmentRun)
      .values({
        orgId: ctx.orgId,
        name: data.name,
        description: data.description ?? null,
        scopeType: data.scopeType,
        scopeFilter: data.scopeFilter ?? null,
        framework: data.framework,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        leadAssessorId: data.leadAssessorId ?? null,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
