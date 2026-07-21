// Process-Portal (Endanwender): read-only detail of a PUBLISHED process.
//
// GET /api/v1/bpm/my-processes/:id — process metadata, current released
// BPMN XML, step list with responsible role names, linked documents,
// risk/control counts (numbers only — details are the modellers'
// domain), the caller's resolved roles and their acknowledgment state.
//
// Only published processes are served — everything else is a 404, so
// end users can never see drafts or working copies through this route.

import {
  db,
  process,
  processStep,
  processVersion,
  processApprovalStep,
  processRaciOverride,
  processDocument,
  processControl,
  processRisk,
  document,
  customRole,
  userCustomRole,
  user,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray, asc, count } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { withAuth, withReadContext } from "@/lib/api";
import {
  resolveMyProcessRoles,
  type RaciOverrideEntry,
} from "@/lib/process-portal-roles";

interface StepRow {
  id: string;
  bpmnElementId: string;
  name: string | null;
  description: string | null;
  stepType: string;
  responsibleRole: string | null;
  sequenceOrder: number;
  raciResponsibleRoleId: string | null;
  raciAccountableRoleId: string | null;
  responsibleRoleName: string | null;
  accountableRoleName: string | null;
}

interface AckRow {
  id: string;
  status: string;
  dueDate: string | null;
  decidedAt: Date | null;
  versionNumber: number;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const ownerUser = alias(user, "ownerUser");
  const [proc] = await db
    .select({
      id: process.id,
      name: process.name,
      description: process.description,
      department: process.department,
      status: process.status,
      currentVersion: process.currentVersion,
      publishedAt: process.publishedAt,
      reviewDate: process.reviewDate,
      processOwnerId: process.processOwnerId,
      ownerName: ownerUser.name,
    })
    .from(process)
    .leftJoin(ownerUser, eq(process.processOwnerId, ownerUser.id))
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        eq(process.status, "published"),
        isNull(process.deletedAt),
      ),
    );

  if (!proc) {
    // Not found OR not published — end users never learn the difference.
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Current released version (diagram shown to end users)
  const [currentVer] = await db
    .select({
      id: processVersion.id,
      versionNumber: processVersion.versionNumber,
      bpmnXml: processVersion.bpmnXml,
      createdAt: processVersion.createdAt,
    })
    .from(processVersion)
    .where(
      and(eq(processVersion.processId, id), eq(processVersion.isCurrent, true)),
    )
    .limit(1);

  // Steps incl. RACI role names (custom_role)
  const responsibleRole = alias(customRole, "responsibleRole");
  const accountableRole = alias(customRole, "accountableRole");
  const steps: StepRow[] = await db
    .select({
      id: processStep.id,
      bpmnElementId: processStep.bpmnElementId,
      name: processStep.name,
      description: processStep.description,
      stepType: processStep.stepType,
      responsibleRole: processStep.responsibleRole,
      sequenceOrder: processStep.sequenceOrder,
      raciResponsibleRoleId: processStep.raciResponsibleRoleId,
      raciAccountableRoleId: processStep.raciAccountableRoleId,
      responsibleRoleName: responsibleRole.name,
      accountableRoleName: accountableRole.name,
    })
    .from(processStep)
    .leftJoin(
      responsibleRole,
      eq(processStep.raciResponsibleRoleId, responsibleRole.id),
    )
    .leftJoin(
      accountableRole,
      eq(processStep.raciAccountableRoleId, accountableRole.id),
    )
    .where(
      and(
        eq(processStep.processId, id),
        eq(processStep.orgId, ctx.orgId),
        isNull(processStep.deletedAt),
      ),
    )
    .orderBy(asc(processStep.sequenceOrder));

  // Linked documents (title + id for the document detail link)
  const documents: Array<{
    documentId: string;
    title: string;
    documentType: string | null;
  }> = await db
    .select({
      documentId: processDocument.documentId,
      title: document.title,
      documentType: processDocument.documentType,
    })
    .from(processDocument)
    .innerJoin(document, eq(processDocument.documentId, document.id))
    .where(
      and(
        eq(processDocument.processId, id),
        eq(processDocument.orgId, ctx.orgId),
      ),
    );

  // Risks/controls: counts only — details are modeller territory.
  const [[{ value: riskCount }], [{ value: controlCount }]] = await Promise.all(
    [
      db
        .select({ value: count() })
        .from(processRisk)
        .where(eq(processRisk.processId, id)),
      db
        .select({ value: count() })
        .from(processControl)
        .where(eq(processControl.processId, id)),
    ],
  );

  // FORCE-RLS reads (process_approval_step) + role resolution inputs.
  const { myRoleIds, overrides, ackRows } = await withReadContext(
    ctx,
    async (tx) => {
      const roleRows: Array<{ customRoleId: string }> = await tx
        .select({ customRoleId: userCustomRole.customRoleId })
        .from(userCustomRole)
        .where(
          and(
            eq(userCustomRole.userId, ctx.userId),
            eq(userCustomRole.orgId, ctx.orgId),
          ),
        );
      const roleIds = roleRows.map((r) => r.customRoleId);

      let overrideRows: RaciOverrideEntry[] = [];
      if (roleIds.length > 0 && currentVer) {
        overrideRows = await tx
          .select({
            participantBpmnId: processRaciOverride.participantBpmnId,
            raciRole: processRaciOverride.raciRole,
          })
          .from(processRaciOverride)
          .where(
            and(
              eq(processRaciOverride.processVersionId, currentVer.id),
              eq(processRaciOverride.orgId, ctx.orgId),
              inArray(processRaciOverride.participantBpmnId, roleIds),
            ),
          );
      }

      const acknowledgmentRows: AckRow[] = await tx
        .select({
          id: processApprovalStep.id,
          status: processApprovalStep.status,
          dueDate: processApprovalStep.dueDate,
          decidedAt: processApprovalStep.decidedAt,
          versionNumber: processApprovalStep.versionNumber,
        })
        .from(processApprovalStep)
        .where(
          and(
            eq(processApprovalStep.processId, id),
            eq(processApprovalStep.orgId, ctx.orgId),
            eq(processApprovalStep.stepType, "acknowledgment"),
            eq(processApprovalStep.assigneeUserId, ctx.userId),
          ),
        )
        .orderBy(asc(processApprovalStep.stepOrder));

      return {
        myRoleIds: roleIds,
        overrides: overrideRows,
        ackRows: acknowledgmentRows,
      };
    },
  );

  const myRoles = resolveMyProcessRoles({
    userId: ctx.userId,
    processOwnerId: proc.processOwnerId,
    userCustomRoleIds: myRoleIds,
    stepRaci: steps.map((s) => ({
      raciResponsibleRoleId: s.raciResponsibleRoleId,
      raciAccountableRoleId: s.raciAccountableRoleId,
    })),
    raciOverrides: overrides,
  });

  // Prefer the acknowledgment step of the current version.
  const ack =
    ackRows.find((row) => row.versionNumber === proc.currentVersion) ??
    ackRows[ackRows.length - 1] ??
    null;

  return Response.json({
    data: {
      id: proc.id,
      name: proc.name,
      description: proc.description,
      department: proc.department,
      currentVersion: proc.currentVersion,
      publishedAt: proc.publishedAt,
      reviewDate: proc.reviewDate,
      ownerName: proc.ownerName,
      bpmnXml: currentVer?.bpmnXml ?? null,
      versionNumber: currentVer?.versionNumber ?? proc.currentVersion,
      steps: steps.map((s) => ({
        id: s.id,
        bpmnElementId: s.bpmnElementId,
        name: s.name,
        description: s.description,
        stepType: s.stepType,
        sequenceOrder: s.sequenceOrder,
        // Precedence: named RACI custom role, then free-text role
        responsibleRoleName: s.responsibleRoleName ?? s.responsibleRole,
        accountableRoleName: s.accountableRoleName,
      })),
      documents,
      riskCount,
      controlCount,
      myRoles,
      acknowledgment: ack
        ? {
            stepId: ack.id,
            status: ack.status,
            dueDate: ack.dueDate,
            decidedAt: ack.decidedAt,
          }
        : null,
    },
  });
}
