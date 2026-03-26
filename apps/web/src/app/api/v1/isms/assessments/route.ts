import { db, assessmentRun } from "@grc/db";
import { requireModule } from "@grc/auth";
import { createAssessmentRunSchema } from "@grc/shared";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/isms/assessments
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const statusFilter = searchParams.get("status");
  const search = searchParams.get("search");

  const conditions: ReturnType<typeof eq>[] = [
    eq(assessmentRun.orgId, ctx.orgId),
  ];
  if (statusFilter) {
    conditions.push(eq(assessmentRun.status, statusFilter as "planning" | "in_progress" | "review" | "completed" | "cancelled"));
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
}

// POST /api/v1/isms/assessments
export async function POST(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = await req.json();
  const parsed = createAssessmentRunSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
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
}
