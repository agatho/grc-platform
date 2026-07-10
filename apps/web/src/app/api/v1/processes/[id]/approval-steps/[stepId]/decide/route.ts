// B2.1 Release-Cycle: decide an approval step (approve / reject).
//
// POST /api/v1/processes/:id/approval-steps/:stepId/decide
//
//  - reject  → step 'rejected' (comment required), remaining open steps
//              'skipped', process back to draft, owner notified.
//  - approve → step 'completed'; next gate step becomes 'in_progress'.
//              When the last review/approval step completes the process
//              is approved automatically (and a working copy, if any, is
//              promoted to the next released version).

import {
  db,
  process,
  processApprovalStep,
  notification,
  userOrganizationRole,
} from "@grc/db";
import {
  decideApprovalStepSchema,
  canDecideApprovalStep,
  evaluateApprovalDecision,
  isDecidableStepStatus,
  type ApprovalStepLike,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext, withReadContext } from "@/lib/api";
import { promoteWorkingVersion } from "@/lib/process-working-version";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;

  const body = decideApprovalStepSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [proc] = await db
    .select({
      id: process.id,
      name: process.name,
      status: process.status,
      processOwnerId: process.processOwnerId,
    })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!proc) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // process_approval_step is FORCE-RLS — reads need the org context.
  const stepRows: Array<typeof processApprovalStep.$inferSelect> =
    await withReadContext(ctx, (tx) =>
      tx
        .select()
        .from(processApprovalStep)
        .where(
          and(
            eq(processApprovalStep.id, stepId),
            eq(processApprovalStep.processId, id),
            eq(processApprovalStep.orgId, ctx.orgId),
          ),
        ),
    );
  const step = stepRows[0];
  if (!step) {
    return Response.json(
      { error: "Approval step not found" },
      { status: 404 },
    );
  }
  if (step.stepType === "acknowledgment") {
    return Response.json(
      { error: "Acknowledgment steps are confirmed via /acknowledge" },
      { status: 422 },
    );
  }
  if (!isDecidableStepStatus(step.status)) {
    return Response.json(
      { error: `Step is ${step.status} and cannot be decided` },
      { status: 422 },
    );
  }

  // Authorization: assigned user, holder of the assigned role, or admin.
  const roleRows = await db
    .select({ role: userOrganizationRole.role })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.userId, ctx.userId),
        eq(userOrganizationRole.orgId, ctx.orgId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );
  const roles = roleRows.map((r) => String(r.role));
  if (!canDecideApprovalStep(step, { userId: ctx.userId, roles })) {
    return Response.json(
      { error: "You are not the assignee of this approval step" },
      { status: 403 },
    );
  }

  // Full chain of this version — the pure helper computes the outcome.
  const chain: ApprovalStepLike[] = await withReadContext(ctx, (tx) =>
    tx
      .select({
        id: processApprovalStep.id,
        stepOrder: processApprovalStep.stepOrder,
        stepType: processApprovalStep.stepType,
        status: processApprovalStep.status,
        assigneeUserId: processApprovalStep.assigneeUserId,
        assigneeRole: processApprovalStep.assigneeRole,
      })
      .from(processApprovalStep)
      .where(
        and(
          eq(processApprovalStep.processId, id),
          eq(processApprovalStep.orgId, ctx.orgId),
          eq(processApprovalStep.versionNumber, step.versionNumber),
        ),
      ),
  );

  let outcome;
  try {
    outcome = evaluateApprovalDecision(
      chain as ApprovalStepLike[],
      stepId,
      body.data.decision,
    );
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }

  const result = await withAuditContext(
    ctx,
    async (tx) => {
      // Persist step updates from the chain evaluation.
      for (const upd of outcome.stepUpdates) {
        const isDecidedStep = upd.id === stepId;
        await tx
          .update(processApprovalStep)
          .set({
            status: upd.status,
            updatedAt: new Date(),
            updatedBy: ctx.userId,
            ...(isDecidedStep
              ? {
                  decision: body.data.decision,
                  comment: body.data.comment ?? null,
                  decidedAt: new Date(),
                  decidedBy: ctx.userId,
                }
              : {}),
          })
          .where(eq(processApprovalStep.id, upd.id));
      }

      // Chain rejected → process back to draft + owner notification.
      if (outcome.processOutcome === "rejected") {
        await tx
          .update(process)
          .set({
            status: "draft",
            updatedBy: ctx.userId,
            updatedAt: new Date(),
          })
          .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId)));

        if (proc.processOwnerId) {
          await tx.insert(notification).values({
            userId: proc.processOwnerId,
            orgId: ctx.orgId,
            type: "status_change",
            entityType: "process",
            entityId: id,
            title: `Process approval rejected: ${proc.name}`,
            message: body.data.comment ?? null,
            channel: "both",
            templateKey: "process_rejected",
            templateData: {
              processId: id,
              processName: proc.name,
              reviewedBy: ctx.userId,
              comment: body.data.comment,
            },
            createdBy: ctx.userId,
          });
        }
      }

      // Chain fully approved → promote working copy (if any) and move the
      // process to approved (unless it is still published — in that case
      // the promotion alone releases the new version).
      if (outcome.processOutcome === "approved") {
        await promoteWorkingVersion({
          tx,
          processId: id,
          orgId: ctx.orgId,
          userId: ctx.userId,
        });

        if (proc.status === "draft" || proc.status === "in_review") {
          await tx
            .update(process)
            .set({
              status: "approved",
              updatedBy: ctx.userId,
              updatedAt: new Date(),
            })
            .where(and(eq(process.id, id), eq(process.orgId, ctx.orgId)));
        }

        if (proc.processOwnerId) {
          await tx.insert(notification).values({
            userId: proc.processOwnerId,
            orgId: ctx.orgId,
            type: "status_change",
            entityType: "process",
            entityId: id,
            title: `Process approved: ${proc.name}`,
            message: body.data.comment ?? null,
            channel: "both",
            templateKey: "process_approved",
            templateData: {
              processId: id,
              processName: proc.name,
              reviewedBy: ctx.userId,
              comment: body.data.comment,
            },
            createdBy: ctx.userId,
          });
        }
      }

      // Chain continues → notify the next assignee.
      if (outcome.processOutcome === null && outcome.nextStepId) {
        const next = chain.find((s) => s.id === outcome.nextStepId);
        if (next?.assigneeUserId) {
          await tx.insert(notification).values({
            userId: next.assigneeUserId,
            orgId: ctx.orgId,
            type: "approval_request",
            entityType: "process",
            entityId: id,
            title: `Approval step assigned: ${proc.name}`,
            message: null,
            channel: "both",
            templateKey: "process_approval_step_assigned",
            templateData: {
              processId: id,
              processName: proc.name,
              stepType: next.stepType,
              requestedBy: ctx.userId,
            },
            createdBy: ctx.userId,
          });
        }
      }

      const [updatedStep] = await tx
        .select()
        .from(processApprovalStep)
        .where(eq(processApprovalStep.id, stepId));
      return updatedStep;
    },
    {
      actionDetail: `Approval step ${body.data.decision} (v${step.versionNumber}, step ${step.stepOrder})`,
      reason: body.data.comment ?? undefined,
    },
  );

  return Response.json({
    data: result,
    meta: { processOutcome: outcome.processOutcome },
  });
}
