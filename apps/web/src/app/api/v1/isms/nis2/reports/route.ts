import {
  db,
  nis2IncidentReport,
  securityIncident,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createNis2IncidentReportSchema } from "@grc/shared";

// POST /api/v1/isms/nis2/reports — Create NIS2 incident report
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createNis2IncidentReportSchema.parse(await req.json());

  // Verify incident exists and belongs to this org
  const [incident] = await db
    .select({ id: securityIncident.id })
    .from(securityIncident)
    .where(
      and(
        eq(securityIncident.id, body.incidentId),
        eq(securityIncident.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!incident) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(nis2IncidentReport)
      .values({
        orgId: ctx.orgId,
        incidentId: body.incidentId,
        reportType: body.reportType,
        deadlineAt: body.deadlineAt,
        bsiReference: body.bsiReference,
        reportContent: body.reportContent,
        contactPerson: body.contactPerson,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        affectedServicesDescription: body.affectedServicesDescription,
        crossBorderImpact: body.crossBorderImpact,
        estimatedImpactCount: body.estimatedImpactCount,
        createdBy: ctx.userId,
      })
      .returning();

    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
