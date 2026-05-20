import { db, copilotSuggestedAction } from "@grc/db";
import { updateSuggestedActionSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/copilot/conversations/:id/actions — List suggested actions
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
    "dpo",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const actions = await db
    .select()
    .from(copilotSuggestedAction)
    .where(
      and(
        eq(copilotSuggestedAction.conversationId, id),
        eq(copilotSuggestedAction.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: actions });
}

// PATCH /api/v1/copilot/conversations/:id/actions — Update action status
//
// RBAC tightening (alpha-readiness overnight 2026-05-18):
// Marking an action `executed` records a permanent claim in the audit chain
// that the suggested action was actually applied. Read-only roles (auditor,
// viewer) must not be able to author that claim. Other state transitions
// (dismissed/pending) remain open to the wider set so reviewers can curate
// the suggestion list.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "dpo",
  );
  if (ctx instanceof Response) return ctx;

  const { id: actionId } = await params;
  const body = updateSuggestedActionSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Only roles with first-/second-line write authority can claim execution.
  if (body.data.status === "executed") {
    const allowedExecutors = new Set([
      "admin",
      "risk_manager",
      "control_owner",
      "process_owner",
      "dpo",
    ]);
    const canExecute = !!ctx.session.user.roles?.some(
      (r) => r.orgId === ctx.orgId && allowedExecutors.has(r.role),
    );
    if (!canExecute) {
      return Response.json(
        {
          error: "Forbidden",
          detail:
            "Marking a copilot action as executed requires a write-authority role (admin, risk_manager, control_owner, process_owner, dpo).",
        },
        { status: 403 },
      );
    }
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(copilotSuggestedAction)
      .set({
        status: body.data.status,
        executedAt: body.data.status === "executed" ? new Date() : undefined,
        executedBy: body.data.status === "executed" ? ctx.userId : undefined,
      })
      .where(
        and(
          eq(copilotSuggestedAction.id, actionId),
          eq(copilotSuggestedAction.orgId, ctx.orgId),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}
