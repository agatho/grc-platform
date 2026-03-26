import { db, managementReview } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createManagementReviewSchema } from "@grc/shared";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/isms/reviews
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const statusFilter = searchParams.get("status");

  const conditions: ReturnType<typeof eq>[] = [
    eq(managementReview.orgId, ctx.orgId),
  ];
  if (statusFilter) {
    conditions.push(eq(managementReview.status, statusFilter as "planned" | "in_progress" | "completed" | "cancelled"));
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
}

// POST /api/v1/isms/reviews
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createManagementReviewSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
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
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
