// POST /api/v1/programmes/journeys/[id]/approval
//
// Two-actions: { action: "request" | "approve" | "reject", notes?, stepId?,
// targetStatus? }
//
// - request: User markiert Step (oder Journey) als "pending approval".
//   Setzt approvalStatus=pending. Optional approvalRequiredForStatus
//   (z.B. "completed" wenn Approval für Status-Change gebraucht wird).
// - approve / reject: Nur admin oder risk_manager. Setzt approvalStatus
//   + approverId + approvedAt. Bei approve+approvalRequiredForStatus:
//   wendet Status-Change automatisch an.
//
// Alle Aktionen werden in programme_approval_event geloggt (append-only).

import {
  db,
  programmeJourney,
  programmeJourneyStep,
  programmeApprovalEvent,
  programmeJourneyEvent,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";

const approvalSchema = z.object({
  action: z.enum(["request", "approve", "reject"]),
  notes: z.string().max(2000).optional(),
  stepId: z.string().uuid().optional(),
  targetStatus: z.string().max(30).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: journeyId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = approvalSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Validate journey
  const [journey] = await db
    .select()
    .from(programmeJourney)
    .where(
      and(
        eq(programmeJourney.id, journeyId),
        eq(programmeJourney.orgId, ctx.orgId),
        isNull(programmeJourney.deletedAt),
      ),
    )
    .limit(1);
  if (!journey) {
    return Response.json({ error: "Journey not found" }, { status: 404 });
  }

  // For approve/reject: only admin/risk_manager
  if (
    (parsed.data.action === "approve" || parsed.data.action === "reject") &&
    !ctx.roles.some((r) => r === "admin" || r === "risk_manager")
  ) {
    return Response.json(
      {
        error: "Only admin or risk_manager can approve or reject.",
      },
      { status: 403 },
    );
  }

  // Determine target row (step vs journey)
  const isStep = !!parsed.data.stepId;
  let fromStatus = "not_required";

  if (isStep) {
    const [step] = await db
      .select()
      .from(programmeJourneyStep)
      .where(
        and(
          eq(programmeJourneyStep.id, parsed.data.stepId!),
          eq(programmeJourneyStep.journeyId, journeyId),
          eq(programmeJourneyStep.orgId, ctx.orgId),
        ),
      )
      .limit(1);
    if (!step) {
      return Response.json({ error: "Step not found" }, { status: 404 });
    }
    fromStatus = step.approvalStatus;
  } else {
    fromStatus = journey.approvalStatus;
  }

  // Compute new status
  const newStatus: "pending" | "approved" | "rejected" =
    parsed.data.action === "request"
      ? "pending"
      : parsed.data.action === "approve"
        ? "approved"
        : "rejected";

  await withAuditContext(ctx, async () => {
    if (isStep) {
      const update: Record<string, unknown> = {
        approvalStatus: newStatus,
        approvalNotes: parsed.data.notes ?? null,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      };
      if (newStatus === "approved" || newStatus === "rejected") {
        update.approverId = ctx.userId;
        update.approvedAt = new Date();
      }
      if (parsed.data.action === "request" && parsed.data.targetStatus) {
        update.approvalRequiredForStatus = parsed.data.targetStatus;
      }
      await db
        .update(programmeJourneyStep)
        .set(update)
        .where(eq(programmeJourneyStep.id, parsed.data.stepId!));

      // Auto-apply status change on approval if requested
      if (newStatus === "approved") {
        const [refreshed] = await db
          .select({
            approvalRequiredForStatus:
              programmeJourneyStep.approvalRequiredForStatus,
          })
          .from(programmeJourneyStep)
          .where(eq(programmeJourneyStep.id, parsed.data.stepId!))
          .limit(1);
        const target = refreshed?.approvalRequiredForStatus;
        if (target) {
          await db
            .update(programmeJourneyStep)
            .set({
              status: target as never,
              approvalRequiredForStatus: null,
            })
            .where(eq(programmeJourneyStep.id, parsed.data.stepId!));
        }
      }
    } else {
      const update: Record<string, unknown> = {
        approvalStatus: newStatus,
        approvalNotes: parsed.data.notes ?? null,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      };
      if (newStatus === "approved" || newStatus === "rejected") {
        update.approverId = ctx.userId;
        update.approvedAt = new Date();
      }
      await db
        .update(programmeJourney)
        .set(update)
        .where(eq(programmeJourney.id, journeyId));
    }

    await db.insert(programmeApprovalEvent).values({
      orgId: ctx.orgId,
      journeyId,
      stepId: parsed.data.stepId ?? null,
      action: parsed.data.action,
      fromStatus,
      toStatus: newStatus,
      actorId: ctx.userId,
      notes: parsed.data.notes ?? null,
    });
  });

  await db.insert(programmeJourneyEvent).values({
    orgId: ctx.orgId,
    journeyId,
    stepId: parsed.data.stepId ?? null,
    eventType: `approval.${parsed.data.action}`,
    actorId: ctx.userId,
    payload: {
      newStatus,
      stepId: parsed.data.stepId,
      targetStatus: parsed.data.targetStatus,
    },
  });

  return Response.json({ data: { ok: true, newStatus } });
}
