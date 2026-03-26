import {
  db,
  dpia,
  dpiaRisk,
  dpiaMeasure,
  user,
} from "@grc/db";
import { updateDpiaSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
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

  const [risks, measures] = await Promise.all([
    db
      .select()
      .from(dpiaRisk)
      .where(and(eq(dpiaRisk.dpiaId, id), eq(dpiaRisk.orgId, ctx.orgId))),
    db
      .select()
      .from(dpiaMeasure)
      .where(and(eq(dpiaMeasure.dpiaId, id), eq(dpiaMeasure.orgId, ctx.orgId))),
  ]);

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
