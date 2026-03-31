import {
  db,
  risk,
  riskTreatment,
  workItem,
  user,
  userOrganizationRole,
} from "@grc/db";
import { createRiskTreatmentSchema } from "@grc/shared";
import { eq, and, isNull, count } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// POST /api/v1/risks/:id/treatments — Create treatment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify risk exists in org
  const [existing] = await db
    .select({ id: risk.id, title: risk.title })
    .from(risk)
    .where(
      and(
        eq(risk.id, id),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  const body = createRiskTreatmentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate responsible is in same org if provided
  if (body.data.responsibleId) {
    const [respRole] = await db
      .select({ id: userOrganizationRole.userId })
      .from(userOrganizationRole)
      .where(
        and(
          eq(userOrganizationRole.userId, body.data.responsibleId),
          eq(userOrganizationRole.orgId, ctx.orgId),
          isNull(userOrganizationRole.deletedAt),
        ),
      );
    if (!respRole) {
      return Response.json(
        { error: "Responsible user not found in this organization" },
        { status: 422 },
      );
    }
  }

  const created = await withAuditContext(ctx, async (tx) => {
    // Create work item for the treatment
    const [wi] = await tx
      .insert(workItem)
      .values({
        orgId: ctx.orgId,
        typeKey: "risk_treatment",
        name: `Treatment: ${body.data.description.substring(0, 100)}`,
        status: "draft",
        responsibleId: body.data.responsibleId,
        grcPerspective: ["erm"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    const [row] = await tx
      .insert(riskTreatment)
      .values({
        orgId: ctx.orgId,
        riskId: id,
        workItemId: wi.id,
        description: body.data.description,
        responsibleId: body.data.responsibleId,
        expectedRiskReduction: body.data.expectedRiskReduction?.toString(),
        costEstimate: body.data.costEstimate?.toString(),
        costAnnual: body.data.costAnnual?.toString(),
        effortHours: body.data.effortHours?.toString(),
        budgetId: body.data.budgetId,
        costNote: body.data.costNote,
        status: body.data.status,
        dueDate: body.data.dueDate,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/risks/:id/treatments — List treatments for risk
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify risk exists in org
  const [existing] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(
        eq(risk.id, id),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  const { page, limit, offset } = paginate(req);

  const conditions = and(
    eq(riskTreatment.riskId, id),
    eq(riskTreatment.orgId, ctx.orgId),
    isNull(riskTreatment.deletedAt),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: riskTreatment.id,
        orgId: riskTreatment.orgId,
        riskId: riskTreatment.riskId,
        workItemId: riskTreatment.workItemId,
        description: riskTreatment.description,
        responsibleId: riskTreatment.responsibleId,
        responsibleName: user.name,
        responsibleEmail: user.email,
        expectedRiskReduction: riskTreatment.expectedRiskReduction,
        costEstimate: riskTreatment.costEstimate,
        costAnnual: riskTreatment.costAnnual,
        effortHours: riskTreatment.effortHours,
        costCurrency: riskTreatment.costCurrency,
        budgetId: riskTreatment.budgetId,
        costNote: riskTreatment.costNote,
        status: riskTreatment.status,
        dueDate: riskTreatment.dueDate,
        createdAt: riskTreatment.createdAt,
        updatedAt: riskTreatment.updatedAt,
      })
      .from(riskTreatment)
      .leftJoin(user, eq(riskTreatment.responsibleId, user.id))
      .where(conditions)
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(riskTreatment)
      .where(conditions),
  ]);

  return paginatedResponse(items, total, page, limit);
}
