import { db, biaAssessment } from "@grc/db";
import { createBiaAssessmentSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc, ilike, or } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/bcms/bia — Create BIA assessment
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createBiaAssessmentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(biaAssessment)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        description: body.data.description,
        periodStart: body.data.periodStart,
        periodEnd: body.data.periodEnd,
        leadAssessorId: body.data.leadAssessorId,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/bcms/bia — List BIA assessments
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(biaAssessment.orgId, ctx.orgId)];

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(biaAssessment.name, pattern),
        ilike(biaAssessment.description, pattern),
      )!,
    );
  }

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const { inArray } = await import("drizzle-orm");
    const statuses = statusParam.split(",") as Array<
      "draft" | "in_progress" | "review" | "approved" | "archived"
    >;
    conditions.push(inArray(biaAssessment.status, statuses));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(biaAssessment)
      .where(where)
      .orderBy(desc(biaAssessment.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(biaAssessment).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
