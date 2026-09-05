import { securityIncident } from "@grc/db";
import { requireModule } from "@grc/auth";
import {
  incidentStatusTransitionSchema,
  isValidIncidentTransition,
} from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { emitEntityStatusChanged } from "@/lib/entity-events";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// PUT /api/v1/isms/incidents/[id]/status
export const PUT = withErrorHandler(async function PUT(
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
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { status: newStatus } = parsed.data;

  let previousStatus: string | null = null;

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
      return {
        error: `Invalid transition from ${current.status} to ${newStatus}`,
      };
    }

    previousStatus = current.status;

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

  // Webhook fan-out (best-effort, after commit — never fails the request)
  emitEntityStatusChanged({
    orgId: ctx.orgId,
    entityType: "incident",
    entityId: id,
    userId: ctx.userId,
    oldStatus: previousStatus ?? "unknown",
    newStatus,
    data: { title: result.title },
  });

  return Response.json({ data: result });
});
