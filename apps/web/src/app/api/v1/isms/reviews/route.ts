import { db, managementReview, reviewStatusEnum } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createManagementReviewSchema } from "@grc/shared";
import { parseQueryParams } from "@/lib/query-schema";
import { eq, and, sql, desc } from "drizzle-orm";
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
const reviewListQuerySchema = z.object({
  status: z.enum(reviewStatusEnum.enumValues).optional(),
});

// GET /api/v1/isms/reviews
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const q = parseQueryParams(reviewListQuerySchema, searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const statusFilter = q.data.status ?? null;

  const conditions: ReturnType<typeof eq>[] = [
    eq(managementReview.orgId, ctx.orgId),
  ];
  if (statusFilter) {
    conditions.push(
      eq(
        managementReview.status,
        statusFilter as "planned" | "in_progress" | "completed" | "cancelled",
      ),
    );
  }

  const rows = await db
    .select()
    .from(managementReview)
    .where(and(...conditions))
    .orderBy(desc(managementReview.reviewDate))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(managementReview)
    .where(and(...conditions));

  return paginatedResponse(rows, total, page, limit);
});
// POST /api/v1/isms/reviews
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createManagementReviewSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(managementReview)
      .values({
        orgId: ctx.orgId,
        title: data.title,
        description: data.description ?? null,
        reviewDate: data.reviewDate,
        chairId: data.chairId ?? null,
        participantIds: data.participantIds,
        nextReviewDate: data.nextReviewDate ?? null,
        periodStart: data.periodStart ?? null,
        periodEnd: data.periodEnd ?? null,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
