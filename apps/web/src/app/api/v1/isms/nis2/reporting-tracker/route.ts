import { db, nis2IncidentReport, securityIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc, isNull } from "drizzle-orm";
import { withAuth, paginate } from "@/lib/api";

// GET /api/v1/isms/nis2/reporting-tracker — Art. 23 Meldepflichten overview
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset } = paginate(req);

  // Get all NIS2 incident reports with linked incident info
  const reports = await db
    .select({
      id: nis2IncidentReport.id,
      incidentId: nis2IncidentReport.incidentId,
      reportType: nis2IncidentReport.reportType,
      status: nis2IncidentReport.status,
      deadlineAt: nis2IncidentReport.deadlineAt,
      submittedAt: nis2IncidentReport.submittedAt,
      bsiReference: nis2IncidentReport.bsiReference,
      contactPerson: nis2IncidentReport.contactPerson,
      createdAt: nis2IncidentReport.createdAt,
      incidentTitle: securityIncident.title,
      incidentElementId: securityIncident.elementId,
      incidentSeverity: securityIncident.severity,
      incidentStatus: securityIncident.status,
      incidentDetectedAt: securityIncident.detectedAt,
    })
    .from(nis2IncidentReport)
    .innerJoin(
      securityIncident,
      eq(nis2IncidentReport.incidentId, securityIncident.id),
    )
    .where(eq(nis2IncidentReport.orgId, ctx.orgId))
    .orderBy(desc(nis2IncidentReport.deadlineAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(nis2IncidentReport)
    .where(eq(nis2IncidentReport.orgId, ctx.orgId));

  // Stats
  const now = new Date();
  const overdueCount = reports.filter(
    (r) => r.status === "draft" && new Date(r.deadlineAt) < now,
  ).length;
  const pendingCount = reports.filter((r) => r.status === "draft").length;
  const submittedCount = reports.filter((r) => r.status === "submitted").length;

  return Response.json({
    data: reports,
    stats: {
      total,
      overdue: overdueCount,
      pending: pendingCount,
      submitted: submittedCount,
    },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
