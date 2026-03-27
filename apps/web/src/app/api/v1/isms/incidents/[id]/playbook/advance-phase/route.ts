import { db, playbookActivation } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { checkAndAdvancePhase } from "@/lib/playbook-engine";

// PUT /api/v1/isms/incidents/[id]/playbook/advance-phase
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: incidentId } = await params;

  // Find the activation for this incident
  const [activation] = await db
    .select()
    .from(playbookActivation)
    .where(
      and(
        eq(playbookActivation.incidentId, incidentId),
        eq(playbookActivation.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!activation) {
    return Response.json({ error: "No playbook activation found for this incident" }, { status: 404 });
  }

  if (activation.status !== "active") {
    return Response.json(
      { error: `Cannot advance phase: playbook status is "${activation.status}"` },
      { status: 400 },
    );
  }

  const result = await checkAndAdvancePhase(activation.id, ctx.orgId, ctx.userId);

  if (!result.advanced) {
    return Response.json(
      { error: "Cannot advance: not all tasks in current phase are completed" },
      { status: 400 },
    );
  }

  return Response.json({
    data: {
      advanced: true,
      newPhaseId: result.newPhaseId,
      completed: result.completed,
    },
  });
}
