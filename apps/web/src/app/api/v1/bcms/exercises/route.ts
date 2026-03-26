import { db, bcExercise } from "@grc/db";
import { createBcExerciseSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc, ilike, or, inArray } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/bcms/exercises — Create exercise
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createBcExerciseSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(bcExercise)
      .values({
        orgId: ctx.orgId,
        title: body.data.title,
        description: body.data.description,
        exerciseType: body.data.exerciseType,
        crisisScenarioId: body.data.crisisScenarioId,
        bcpId: body.data.bcpId,
        plannedDate: body.data.plannedDate,
        plannedDurationHours: body.data.plannedDurationHours,
        exerciseLeadId: body.data.exerciseLeadId,
        participantIds: body.data.participantIds,
        objectives: body.data.objectives,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/bcms/exercises — List exercises
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(bcExercise.orgId, ctx.orgId)];

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<"planned" | "preparation" | "executing" | "evaluation" | "completed" | "cancelled">;
    conditions.push(inArray(bcExercise.status, statuses));
  }

  const typeParam = searchParams.get("type");
  if (typeParam) {
    const types = typeParam.split(",") as Array<"tabletop" | "walkthrough" | "functional" | "full_simulation">;
    conditions.push(inArray(bcExercise.exerciseType, types));
  }

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(ilike(bcExercise.title, pattern), ilike(bcExercise.description, pattern))!);
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db.select().from(bcExercise).where(where).orderBy(desc(bcExercise.plannedDate)).limit(limit).offset(offset),
    db.select({ value: count() }).from(bcExercise).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
