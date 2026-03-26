import { db, securityIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import { incidentStatusTransitionSchema, isValidIncidentTransition } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/isms/incidents/[id]/status
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();

  const parsed = incidentStatusTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { status: newStatus } = parsed.data;

  const result = await withAuditContext(ctx, async (tx) => {
    // Get current status
    const [current] = await tx
      .select({ id: securityIncident.id, status: securityIncident.status })
      .from(securityIncident)
      .where(
        and(
          eq(securityIncident.id, id),
          eq(securityIncident.orgId, ctx.orgId),
          isNull(securityIncident.deletedAt),
        ),
      )
      .limit(1);

    if (!current) {
      return null;
    }

    if (!isValidIncidentTransition(current.status, newStatus)) {
      return { error: `Invalid transition from ${current.status} to ${newStatus}` };
    }

    const setValues: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    };

    if (newStatus === "closed") {
      setValues.closedAt = new Date();
    }

    const [updated] = await tx
      .update(securityIncident)
      .set(setValues)
      .where(eq(securityIncident.id, id))
      .returning();

    return updated;
  });

  if (!result) {
    return Response.json({ error: "Incident not found" }, { status: 404 });
  }

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 422 });
  }

  return Response.json({ data: result });
}
