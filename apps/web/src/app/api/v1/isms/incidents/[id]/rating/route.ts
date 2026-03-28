import { db } from "@grc/db";
import { incidentRatingSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PATCH /api/v1/isms/incidents/:id/rating — Update post-incident rating
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: incidentId } = await params;
  const body = incidentRatingSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify incident exists and check status
  const result = await db.execute(
    sql`SELECT id, status FROM security_incident
        WHERE id = ${incidentId} AND org_id = ${ctx.orgId} AND deleted_at IS NULL LIMIT 1`,
  );

  const incident = result[0];
  if (!incident) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  // Only allow rating when resolved or closed
  const allowedStatuses = ["recovered", "lessons_learned", "closed"];
  if (!allowedStatuses.includes(String(incident.status))) {
    return Response.json(
      { error: "Incident must be in resolved or closed state for rating" },
      { status: 422 },
    );
  }

  await withAuditContext(ctx, async (tx) => {
    await tx.execute(
      sql`UPDATE security_incident SET
            severity = ${body.data.overall_severity_rating},
            lessons_learned = ${body.data.lessons_learned ?? null},
            updated_at = NOW(), updated_by = ${ctx.userId}
          WHERE id = ${incidentId} AND org_id = ${ctx.orgId}`,
    );
  });

  return Response.json({
    data: {
      id: incidentId,
      overallSeverityRating: body.data.overall_severity_rating,
      responseEffectiveness: body.data.response_effectiveness,
      communicationQuality: body.data.communication_quality,
      lessonsLearned: body.data.lessons_learned,
    },
  });
}

// GET /api/v1/isms/incidents/:id/rating — Get post-incident rating
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: incidentId } = await params;

  const result = await db.execute(
    sql`SELECT id, status, severity, lessons_learned
        FROM security_incident
        WHERE id = ${incidentId} AND org_id = ${ctx.orgId} AND deleted_at IS NULL LIMIT 1`,
  );

  const incident = result[0];
  if (!incident) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  const isEditable = ["recovered", "lessons_learned", "closed"].includes(String(incident.status));

  return Response.json({
    data: {
      overallSeverityRating: incident.severity ?? null,
      responseEffectiveness: null,
      communicationQuality: null,
      lessonsLearned: incident.lessons_learned ?? null,
      isEditable,
    },
  });
}
