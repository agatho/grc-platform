import { db, bcpProcedure, bcp } from "@grc/db";
import { createBcpProcedureSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count, asc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// POST /api/v1/bcms/plans/[id]/procedures — Create procedure step
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: bcpId } = await params;

  const body = createBcpProcedureSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify BCP exists
  const [plan] = await db
    .select({ id: bcp.id })
    .from(bcp)
    .where(
      and(eq(bcp.id, bcpId), eq(bcp.orgId, ctx.orgId), isNull(bcp.deletedAt)),
    );

  if (!plan) {
    return Response.json({ error: "BCP not found" }, { status: 404 });
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(bcpProcedure)
      .values({
        bcpId,
        orgId: ctx.orgId,
        stepNumber: body.data.stepNumber,
        title: body.data.title,
        description: body.data.description,
        responsibleRole: body.data.responsibleRole,
        responsibleId: body.data.responsibleId,
        estimatedDurationMinutes: body.data.estimatedDurationMinutes,
        requiredResources: body.data.requiredResources,
        prerequisites: body.data.prerequisites,
        successCriteria: body.data.successCriteria,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/bcms/plans/[id]/procedures — List procedures
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: bcpId } = await params;
  const { page, limit, offset } = paginate(req);

  const where = and(
    eq(bcpProcedure.bcpId, bcpId),
    eq(bcpProcedure.orgId, ctx.orgId),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(bcpProcedure)
      .where(where)
      .orderBy(asc(bcpProcedure.stepNumber))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(bcpProcedure).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
