// B2.1 Release-Cycle: definable multi-stage approval chain per process
// version (Marktführer-Muster: 1 Prüfer → 1 Freigeber → Kenntnisnahme).
//
// GET  /api/v1/processes/:id/approval-steps            — list chain
// POST /api/v1/processes/:id/approval-steps            — (re)define chain

import { db, process, processApprovalStep, user, notification } from "@grc/db";
import { createApprovalStepsSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, asc, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { withAuth, withAuditContext, withReadContext } from "@/lib/api";
import { findWorkingVersion } from "@/lib/process-working-version";

// GET /api/v1/processes/:id/approval-steps?versionNumber=N
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const [existing] = await db
    .select({ id: process.id, currentVersion: process.currentVersion })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const rawVersion = url.searchParams.get("versionNumber");
  let versionNumber: number | null = null;
  if (rawVersion !== null) {
    versionNumber = Number(rawVersion);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return Response.json(
        { error: "versionNumber must be a positive integer" },
        { status: 422 },
      );
    }
  }

  const assigneeUser = alias(user, "assigneeUser");
  const deciderUser = alias(user, "deciderUser");

  const conditions = [
    eq(processApprovalStep.processId, id),
    eq(processApprovalStep.orgId, ctx.orgId),
  ];
  if (versionNumber !== null) {
    conditions.push(eq(processApprovalStep.versionNumber, versionNumber));
  }

  // process_approval_step is a FORCE-RLS table — reads need the org
  // context session variable (withReadContext).
  const steps = await withReadContext(ctx, (tx) =>
    tx
      .select({
        id: processApprovalStep.id,
      processId: processApprovalStep.processId,
      versionNumber: processApprovalStep.versionNumber,
      stepOrder: processApprovalStep.stepOrder,
      stepType: processApprovalStep.stepType,
      assigneeUserId: processApprovalStep.assigneeUserId,
      assigneeUserName: assigneeUser.name,
      assigneeRole: processApprovalStep.assigneeRole,
      status: processApprovalStep.status,
      decision: processApprovalStep.decision,
      comment: processApprovalStep.comment,
      decidedAt: processApprovalStep.decidedAt,
      decidedBy: processApprovalStep.decidedBy,
      decidedByName: deciderUser.name,
      dueDate: processApprovalStep.dueDate,
      createdAt: processApprovalStep.createdAt,
      })
      .from(processApprovalStep)
      .leftJoin(
        assigneeUser,
        eq(processApprovalStep.assigneeUserId, assigneeUser.id),
      )
      .leftJoin(deciderUser, eq(processApprovalStep.decidedBy, deciderUser.id))
      .where(and(...conditions))
      .orderBy(
        asc(processApprovalStep.versionNumber),
        asc(processApprovalStep.stepOrder),
      ),
  );

  return Response.json({
    data: steps,
    meta: { currentVersion: existing.currentVersion },
  });
}

// POST /api/v1/processes/:id/approval-steps — define the approval chain.
// Without an explicit `steps` array the default chain is created:
// 1 reviewer (process.reviewerId or role 'auditor') → 1 approver
// (role 'admin') → acknowledgment step per acknowledgmentUserIds entry.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = createApprovalStepsSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [existing] = await db
    .select({
      id: process.id,
      name: process.name,
      currentVersion: process.currentVersion,
      status: process.status,
      reviewerId: process.reviewerId,
    })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );
  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Chain targets the working copy when one exists (re-approval of a
  // published process), otherwise the current version.
  const working = await findWorkingVersion(db, id);
  const versionNumber =
    body.data.versionNumber ??
    working?.versionNumber ??
    existing.currentVersion;

  // A chain with decided steps must not be silently replaced.
  // (FORCE-RLS table — read via withReadContext.)
  const existingSteps: Array<{ id: string; status: string }> =
    await withReadContext(ctx, (tx) =>
      tx
        .select({
          id: processApprovalStep.id,
          status: processApprovalStep.status,
        })
        .from(processApprovalStep)
        .where(
          and(
            eq(processApprovalStep.processId, id),
            eq(processApprovalStep.orgId, ctx.orgId),
            eq(processApprovalStep.versionNumber, versionNumber),
          ),
        ),
    );
  const hasDecided = existingSteps.some((s) =>
    ["completed", "rejected"].includes(s.status),
  );
  if (hasDecided) {
    return Response.json(
      {
        error:
          "Approval chain for this version already has decided steps and cannot be replaced",
      },
      { status: 409 },
    );
  }

  // Build the step list (explicit chain or default chain).
  type NewStep = {
    stepType: "review" | "approval" | "acknowledgment";
    assigneeUserId: string | null;
    assigneeRole: string | null;
    dueDate: string | null;
  };
  const stepsInput: NewStep[] = body.data.steps
    ? body.data.steps.map((s) => ({
        stepType: s.stepType,
        assigneeUserId: s.assigneeUserId ?? null,
        assigneeRole: s.assigneeRole ?? null,
        dueDate: s.dueDate ?? null,
      }))
    : [
        existing.reviewerId
          ? {
              stepType: "review" as const,
              assigneeUserId: existing.reviewerId,
              assigneeRole: null,
              dueDate: null,
            }
          : {
              stepType: "review" as const,
              assigneeUserId: null,
              assigneeRole: "auditor",
              dueDate: null,
            },
        {
          stepType: "approval" as const,
          assigneeUserId: null,
          assigneeRole: "admin",
          dueDate: null,
        },
        ...(body.data.acknowledgmentUserIds ?? []).map((userId) => ({
          stepType: "acknowledgment" as const,
          assigneeUserId: userId,
          assigneeRole: null,
          dueDate: null,
        })),
      ];

  const created = await withAuditContext(
    ctx,
    async (tx) => {
      // Replace any undecided previous chain for this version.
      if (existingSteps.length > 0) {
        await tx.delete(processApprovalStep).where(
          inArray(
            processApprovalStep.id,
            existingSteps.map((s) => s.id),
          ),
        );
      }

      const rows = [];
      let firstGateNotified = false;
      for (let i = 0; i < stepsInput.length; i++) {
        const s = stepsInput[i];
        const isFirstGate =
          !firstGateNotified && s.stepType !== "acknowledgment";
        const [row] = await tx
          .insert(processApprovalStep)
          .values({
            orgId: ctx.orgId,
            processId: id,
            versionNumber,
            stepOrder: i + 1,
            stepType: s.stepType,
            assigneeUserId: s.assigneeUserId,
            assigneeRole: s.assigneeRole,
            status: isFirstGate ? "in_progress" : "pending",
            dueDate: s.dueDate,
            createdBy: ctx.userId,
          })
          .returning();
        rows.push(row);

        // Notify the assignee of the first active gate step.
        if (isFirstGate && s.assigneeUserId) {
          await tx.insert(notification).values({
            userId: s.assigneeUserId,
            orgId: ctx.orgId,
            type: "approval_request",
            entityType: "process",
            entityId: id,
            title: `Approval step assigned: ${existing.name}`,
            message: null,
            channel: "both",
            templateKey: "process_approval_step_assigned",
            templateData: {
              processId: id,
              processName: existing.name,
              stepType: s.stepType,
              requestedBy: ctx.userId,
            },
            createdBy: ctx.userId,
          });
        }
        if (isFirstGate) firstGateNotified = true;
      }
      return rows;
    },
    { actionDetail: `Approval chain defined (v${versionNumber})` },
  );

  return Response.json({ data: created }, { status: 201 });
}
