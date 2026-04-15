import {
  db,
  dpia,
  dpiaRisk,
  dpiaMeasure,
  user,
} from "@grc/db";
import { updateDpiaSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/dpms/dpia/:id — Full DPIA detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select({
      id: dpia.id,
      orgId: dpia.orgId,
      workItemId: dpia.workItemId,
      title: dpia.title,
      processingDescription: dpia.processingDescription,
      legalBasis: dpia.legalBasis,
      necessityAssessment: dpia.necessityAssessment,
      dpoConsultationRequired: dpia.dpoConsultationRequired,
      systematicDescription: dpia.systematicDescription,
      dataCategories: dpia.dataCategories,
      dataSubjectCategories: dpia.dataSubjectCategories,
      recipients: dpia.recipients,
      thirdCountryTransfers: dpia.thirdCountryTransfers,
      retentionPeriod: dpia.retentionPeriod,
      consultationResult: dpia.consultationResult,
      consultationDate: dpia.consultationDate,
      nextReviewDate: dpia.nextReviewDate,
      dpoOpinion: dpia.dpoOpinion,
      status: dpia.status,
      residualRiskSignOffId: dpia.residualRiskSignOffId,
      signOffName: user.name,
      createdAt: dpia.createdAt,
      updatedAt: dpia.updatedAt,
      createdBy: dpia.createdBy,
    })
    .from(dpia)
    .leftJoin(user, eq(dpia.residualRiskSignOffId, user.id))
    .where(
      and(
        eq(dpia.id, id),
        eq(dpia.orgId, ctx.orgId),
        isNull(dpia.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Use raw SQL for risks to include migration-only numeric columns
  const [risksResult, measures] = await Promise.all([
    db.execute(sql`
      SELECT id, org_id AS "orgId", dpia_id AS "dpiaId",
             risk_description AS "riskDescription",
             severity, likelihood, impact,
             numeric_likelihood, numeric_impact, risk_score,
             erm_risk_id, erm_synced_at,
             created_at AS "createdAt"
      FROM dpia_risk
      WHERE dpia_id = ${id}::uuid AND org_id = ${ctx.orgId}
      ORDER BY created_at
    `),
    db
      .select({
        id: dpiaMeasure.id,
        orgId: dpiaMeasure.orgId,
        dpiaId: dpiaMeasure.dpiaId,
        measureDescription: dpiaMeasure.measureDescription,
        riskId: dpiaMeasure.riskId,
        implementationTimeline: dpiaMeasure.implementationTimeline,
        costOnetime: dpiaMeasure.costOnetime,
        costAnnual: dpiaMeasure.costAnnual,
        effortHours: dpiaMeasure.effortHours,
        costCurrency: dpiaMeasure.costCurrency,
        costNote: dpiaMeasure.costNote,
        createdAt: dpiaMeasure.createdAt,
      })
      .from(dpiaMeasure)
      .where(and(eq(dpiaMeasure.dpiaId, id), eq(dpiaMeasure.orgId, ctx.orgId))),
  ]);

  const risks = risksResult.rows ?? [];

  return Response.json({ data: { ...row, risks, measures } });
}

// PUT /api/v1/dpms/dpia/:id — Update DPIA
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(dpia)
    .where(
      and(
        eq(dpia.id, id),
        eq(dpia.orgId, ctx.orgId),
        isNull(dpia.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = updateDpiaSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(dpia)
      .set({
        ...body.data,
        updatedAt: new Date(),
      })
      .where(eq(dpia.id, id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
