import { db, recoveryProcedure, recoveryProcedureStep } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { createRecoveryProcedureSchema } from "@grc/shared";

// GET /api/v1/bcms/recovery-procedures — List recovery procedures
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);
  const where = eq(recoveryProcedure.orgId, ctx.orgId);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(recoveryProcedure)
      .where(where)
      .orderBy(desc(recoveryProcedure.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(recoveryProcedure).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}

// POST /api/v1/bcms/recovery-procedures — Create procedure with steps
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createRecoveryProcedureSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { steps, ...procedureData } = body.data;

  const created = await withAuditContext(ctx, async (tx) => {
    const [procedure] = await tx
      .insert(recoveryProcedure)
      .values({
        orgId: ctx.orgId,
        createdBy: ctx.userId,
        ...procedureData,
      })
      .returning();

    // Insert steps with dependency remapping
    const stepIdMap = new Map<number, string>();
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const [inserted] = await tx
        .insert(recoveryProcedureStep)
        .values({
          procedureId: procedure.id,
          sortOrder: i,
          title: step.title,
          description: step.description,
          responsibleRole: step.responsibleRole,
          estimatedDurationMinutes: step.estimatedDurationMinutes,
          requiredResources: step.requiredResources,
          dependsOnStepId:
            step.dependsOnStepIndex !== undefined
              ? stepIdMap.get(step.dependsOnStepIndex)
              : undefined,
        })
        .returning();
      stepIdMap.set(i, inserted.id);
    }

    return procedure;
  });

  return Response.json({ data: created }, { status: 201 });
}
