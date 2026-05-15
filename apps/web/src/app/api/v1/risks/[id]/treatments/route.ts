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
import { log } from "@/lib/logger";

// POST /api/v1/risks/:id/treatments — Create treatment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // #WAVE19-MAR-P0-01: process_owner is the 1st-line risk owner and
  // proposes the treatment that mitigates their own risk. Without
  // this they had to escalate every treatment to the CISO.
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify risk exists in org
  const [existing] = await db
    .select({ id: risk.id, title: risk.title })
    .from(risk)
    .where(
      and(eq(risk.id, id), eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)),
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

  const logger = log.withContext({
    route: "POST /api/v1/risks/[id]/treatments",
    userId: ctx.userId,
    orgId: ctx.orgId,
    riskId: id,
  });

  try {
    const created = await withAuditContext(ctx, async (tx) => {
      // Create work item for the treatment. typeKey "risk_treatment" must
      // exist in work_item_type — migration 0301 backfills it for tenants
      // that pre-date the seed (QA-017, 2026-05-11).
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
  } catch (err) {
    // Map known Postgres constraint failures to 422 so the client gets a
    // useful message; everything else surfaces as a structured 500 with the
    // pgCode in the body so operators can pivot from a deploy alert to the
    // exact constraint name.
    const errObj = err as { code?: string; detail?: string; message?: string };
    logger.error("treatment create failed", {
      pgCode: errObj.code,
      pgDetail: errObj.detail,
      message: errObj.message,
    });

    // 23503 = foreign_key_violation, 23502 = not_null_violation, 23514 = check_violation
    const constraintCodes = new Set(["23503", "23502", "23514", "23505"]);
    if (errObj.code && constraintCodes.has(errObj.code)) {
      return Response.json(
        {
          error: "Failed to create treatment — database constraint",
          code: errObj.code,
          detail: errObj.detail ?? errObj.message ?? null,
        },
        { status: 422 },
      );
    }

    return Response.json(
      {
        error: "Failed to create treatment",
        code: errObj.code ?? "internal",
      },
      { status: 500 },
    );
  }
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
      and(eq(risk.id, id), eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)),
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
    db.select({ value: count() }).from(riskTreatment).where(conditions),
  ]);

  return paginatedResponse(items, total, page, limit);
}
