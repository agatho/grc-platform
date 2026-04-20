import { db, nis2IncidentReport, securityIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateNis2IncidentReportSchema } from "@grc/shared";

// GET /api/v1/isms/nis2/reports/:id — Get single NIS2 report
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [report] = await db
    .select({
      id: nis2IncidentReport.id,
      orgId: nis2IncidentReport.orgId,
      incidentId: nis2IncidentReport.incidentId,
      reportType: nis2IncidentReport.reportType,
      status: nis2IncidentReport.status,
      deadlineAt: nis2IncidentReport.deadlineAt,
      submittedAt: nis2IncidentReport.submittedAt,
      bsiReference: nis2IncidentReport.bsiReference,
      reportContent: nis2IncidentReport.reportContent,
      contactPerson: nis2IncidentReport.contactPerson,
      contactEmail: nis2IncidentReport.contactEmail,
      contactPhone: nis2IncidentReport.contactPhone,
      affectedServicesDescription:
        nis2IncidentReport.affectedServicesDescription,
      crossBorderImpact: nis2IncidentReport.crossBorderImpact,
      estimatedImpactCount: nis2IncidentReport.estimatedImpactCount,
      createdAt: nis2IncidentReport.createdAt,
      updatedAt: nis2IncidentReport.updatedAt,
      incidentTitle: securityIncident.title,
      incidentElementId: securityIncident.elementId,
      incidentSeverity: securityIncident.severity,
    })
    .from(nis2IncidentReport)
    .innerJoin(
      securityIncident,
      eq(nis2IncidentReport.incidentId, securityIncident.id),
    )
    .where(
      and(
        eq(nis2IncidentReport.id, id),
        eq(nis2IncidentReport.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!report) {
    return Response.json({ error: "Report not found" }, { status: 404 });
  }

  return Response.json({ data: report });
}

// PATCH /api/v1/isms/nis2/reports/:id — Update NIS2 report
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = updateNis2IncidentReportSchema.parse(await req.json());

  const [existing] = await db
    .select({ id: nis2IncidentReport.id, status: nis2IncidentReport.status })
    .from(nis2IncidentReport)
    .where(
      and(
        eq(nis2IncidentReport.id, id),
        eq(nis2IncidentReport.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Report not found" }, { status: 404 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const updateValues: Record<string, unknown> = {
      ...body,
      updatedAt: new Date(),
    };

    // If status is changing to submitted, set submittedAt
    if (body.status === "submitted" && existing.status !== "submitted") {
      updateValues.submittedAt = new Date();
    }

    const [updated] = await tx
      .update(nis2IncidentReport)
      .set(updateValues)
      .where(eq(nis2IncidentReport.id, id))
      .returning();

    return updated;
  });

  return Response.json({ data: result });
}
