import {
  db,
  dataBreach,
  dataBreachNotification,
  user,
} from "@grc/db";
import { updateDataBreachSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/dpms/breaches/:id — Full breach detail
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
      id: dataBreach.id,
      orgId: dataBreach.orgId,
      workItemId: dataBreach.workItemId,
      incidentId: dataBreach.incidentId,
      title: dataBreach.title,
      description: dataBreach.description,
      severity: dataBreach.severity,
      status: dataBreach.status,
      detectedAt: dataBreach.detectedAt,
      dpaNotifiedAt: dataBreach.dpaNotifiedAt,
      individualsNotifiedAt: dataBreach.individualsNotifiedAt,
      isDpaNotificationRequired: dataBreach.isDpaNotificationRequired,
      isIndividualNotificationRequired: dataBreach.isIndividualNotificationRequired,
      dataCategoriesAffected: dataBreach.dataCategoriesAffected,
      estimatedRecordsAffected: dataBreach.estimatedRecordsAffected,
      affectedCountries: dataBreach.affectedCountries,
      containmentMeasures: dataBreach.containmentMeasures,
      remediationMeasures: dataBreach.remediationMeasures,
      lessonsLearned: dataBreach.lessonsLearned,
      dpoId: dataBreach.dpoId,
      assigneeId: dataBreach.assigneeId,
      assigneeName: user.name,
      closedAt: dataBreach.closedAt,
      createdAt: dataBreach.createdAt,
      updatedAt: dataBreach.updatedAt,
      createdBy: dataBreach.createdBy,
    })
    .from(dataBreach)
    .leftJoin(user, eq(dataBreach.assigneeId, user.id))
    .where(
      and(
        eq(dataBreach.id, id),
        eq(dataBreach.orgId, ctx.orgId),
        isNull(dataBreach.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const notifications = await db
    .select()
    .from(dataBreachNotification)
    .where(
      and(
        eq(dataBreachNotification.dataBreachId, id),
        eq(dataBreachNotification.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: { ...row, notifications } });
}

// PUT /api/v1/dpms/breaches/:id — Update breach
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
    .from(dataBreach)
    .where(
      and(
        eq(dataBreach.id, id),
        eq(dataBreach.orgId, ctx.orgId),
        isNull(dataBreach.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = updateDataBreachSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(dataBreach)
      .set({
        ...body.data,
        updatedAt: new Date(),
      })
      .where(eq(dataBreach.id, id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
