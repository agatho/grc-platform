import { db, architectureElement, eamGovernanceLog } from "@grc/db";
import { requireModule } from "@grc/auth";
import { governanceTransitionSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

const GOVERNANCE_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_review"],
  pending_review: ["approved", "rejected"],
  approved: ["published"],
  published: ["archived", "draft"],
  rejected: ["draft"],
  archived: [],
};

// POST /api/v1/eam/governance/publish — Governance state transition
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const elementId = url.searchParams.get("elementId");
  if (!elementId)
    return Response.json({ error: "elementId required" }, { status: 400 });

  const body = await req.json();
  const parsed = governanceTransitionSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const element = await db
    .select()
    .from(architectureElement)
    .where(
      and(
        eq(architectureElement.id, elementId),
        eq(architectureElement.orgId, ctx.orgId),
      ),
    )
    .limit(1);

  if (!element.length)
    return Response.json({ error: "Element not found" }, { status: 404 });

  const currentStatus = element[0].governanceStatus ?? "draft";
  const actionToStatus: Record<string, string> = {
    publish: "pending_review",
    approve: "approved",
    reject: "rejected",
    archive: "archived",
    change_to_suggestion: "draft",
  };

  const targetStatus = actionToStatus[parsed.data.action];
  if (!targetStatus)
    return Response.json({ error: "Invalid action" }, { status: 400 });

  const validTransitions = GOVERNANCE_TRANSITIONS[currentStatus] ?? [];
  if (!validTransitions.includes(targetStatus)) {
    return Response.json(
      {
        error: `Cannot transition from '${currentStatus}' to '${targetStatus}'`,
      },
      { status: 400 },
    );
  }

  // Enforce: only examiner/admin can approve/reject
  if (["approve", "reject"].includes(parsed.data.action)) {
    const isExaminer = element[0].examinerId === ctx.userId;
    // Admin can always approve/reject (ctx already verified admin role)
    if (!isExaminer) {
      return Response.json(
        { error: "Only the examiner or admin can approve/reject" },
        { status: 403 },
      );
    }
  }

  // Reject requires justification
  if (parsed.data.action === "reject" && !parsed.data.justification) {
    return Response.json(
      { error: "Justification is required for rejection" },
      { status: 400 },
    );
  }

  // Update element status
  await db
    .update(architectureElement)
    .set({ governanceStatus: targetStatus, updatedAt: new Date() })
    .where(eq(architectureElement.id, elementId));

  // Log governance action (immutable)
  await db.insert(eamGovernanceLog).values({
    orgId: ctx.orgId,
    elementId,
    elementType: element[0].type,
    fromStatus: currentStatus,
    toStatus: targetStatus,
    action: parsed.data.action,
    performedBy: ctx.userId,
    justification: parsed.data.justification,
  });

  return Response.json({
    data: {
      elementId,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      action: parsed.data.action,
    },
  });
}
