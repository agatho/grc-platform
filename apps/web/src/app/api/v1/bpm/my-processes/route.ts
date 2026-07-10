// Process-Portal (Endanwender): "Meine Prozesse".
//
// GET /api/v1/bpm/my-processes?search=… — all PUBLISHED processes in
// which the calling user has a role, determined by:
//   (a) process ownership (process.process_owner_id),
//   (b) RACI assignments (process_step.raci_*_role_id + overrides on the
//       current released version, resolved via user_custom_role),
//   (c) acknowledgment steps assigned to the user (pending Kenntnisnahme
//       keeps the process visible even without any other role).
//
// Naming follows the module-scoped "my" convention (policies/my-pending,
// rcsa/my-assignments, bpm/my-homepage). Open to every authenticated org
// member — end users are exactly the audience of this portal view.

import {
  process,
  processStep,
  processVersion,
  processApprovalStep,
  processRaciOverride,
  userCustomRole,
  user,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, or, isNull, inArray, asc, ilike } from "drizzle-orm";
import { withAuth, withReadContext } from "@/lib/api";
import {
  resolveMyProcessRoles,
  type MyProcessRole,
  type StepRaciAssignment,
  type RaciOverrideEntry,
} from "@/lib/process-portal-roles";

interface ProcessRow {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  currentVersion: number;
  publishedAt: Date | null;
  processOwnerId: string | null;
  ownerName: string | null;
}

interface AckRow {
  id: string;
  processId: string;
  status: string;
  dueDate: string | null;
  decidedAt: Date | null;
  versionNumber: number;
}

interface StepRaciRow extends StepRaciAssignment {
  processId: string;
}

interface OverrideRow extends RaciOverrideEntry {
  processId: string;
}

export interface MyProcessListItem extends ProcessRow {
  myRoles: MyProcessRole[];
  acknowledgment: {
    stepId: string;
    status: string;
    dueDate: string | null;
    decidedAt: Date | null;
  } | null;
}

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() ?? "";

  // process_approval_step is a FORCE-RLS table — all reads (they share
  // one transaction) run with the org context session variable set.
  const { myRoleIds, processes, stepRaci, overrides, ackRows } =
    await withReadContext(ctx, async (tx) => {
      // 1. Custom roles of the user (user ↔ custom_role via user_custom_role)
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

      // 2. Published processes of the org (+ optional search filter)
      const conditions = [
        eq(process.orgId, ctx.orgId),
        eq(process.status, "published"),
        isNull(process.deletedAt),
      ];
      if (search) {
        const pattern = `%${search}%`;
        const searchCondition = or(
          ilike(process.name, pattern),
          ilike(process.description, pattern),
        );
        if (searchCondition) conditions.push(searchCondition);
      }
      const processRows: ProcessRow[] = await tx
        .select({
          id: process.id,
          name: process.name,
          description: process.description,
          department: process.department,
          currentVersion: process.currentVersion,
          publishedAt: process.publishedAt,
          processOwnerId: process.processOwnerId,
          ownerName: user.name,
        })
        .from(process)
        .leftJoin(user, eq(process.processOwnerId, user.id))
        .where(and(...conditions))
        .orderBy(asc(process.name));

      const processIds = processRows.map((p) => p.id);

      // 3. Step RACI hits (raci_*_role_id → custom_role of the user)
      let stepRows: StepRaciRow[] = [];
      let overrideRows: OverrideRow[] = [];
      if (roleIds.length > 0 && processIds.length > 0) {
        const raciHit = or(
          inArray(processStep.raciResponsibleRoleId, roleIds),
          inArray(processStep.raciAccountableRoleId, roleIds),
        );
        stepRows = await tx
          .select({
            processId: processStep.processId,
            raciResponsibleRoleId: processStep.raciResponsibleRoleId,
            raciAccountableRoleId: processStep.raciAccountableRoleId,
          })
          .from(processStep)
          .where(
            and(
              eq(processStep.orgId, ctx.orgId),
              inArray(processStep.processId, processIds),
              isNull(processStep.deletedAt),
              raciHit,
            ),
          );

        // 4. Overrides on the current released version
        //    (participant_bpmn_id = custom_role id, see B3.1)
        overrideRows = await tx
          .select({
            processId: processVersion.processId,
            participantBpmnId: processRaciOverride.participantBpmnId,
            raciRole: processRaciOverride.raciRole,
          })
          .from(processRaciOverride)
          .innerJoin(
            processVersion,
            eq(processRaciOverride.processVersionId, processVersion.id),
          )
          .where(
            and(
              eq(processRaciOverride.orgId, ctx.orgId),
              eq(processVersion.isCurrent, true),
              inArray(processVersion.processId, processIds),
              inArray(processRaciOverride.participantBpmnId, roleIds),
            ),
          );
      }

      // 5. Acknowledgment steps assigned to the user
      let acknowledgmentRows: AckRow[] = [];
      if (processIds.length > 0) {
        acknowledgmentRows = await tx
          .select({
            id: processApprovalStep.id,
            processId: processApprovalStep.processId,
            status: processApprovalStep.status,
            dueDate: processApprovalStep.dueDate,
            decidedAt: processApprovalStep.decidedAt,
            versionNumber: processApprovalStep.versionNumber,
          })
          .from(processApprovalStep)
          .where(
            and(
              eq(processApprovalStep.orgId, ctx.orgId),
              eq(processApprovalStep.stepType, "acknowledgment"),
              eq(processApprovalStep.assigneeUserId, ctx.userId),
              inArray(processApprovalStep.processId, processIds),
            ),
          )
          .orderBy(asc(processApprovalStep.stepOrder));
      }

      return {
        myRoleIds: roleIds,
        processes: processRows,
        stepRaci: stepRows,
        overrides: overrideRows,
        ackRows: acknowledgmentRows,
      };
    });

  const stepsByProcess = new Map<string, StepRaciAssignment[]>();
  for (const row of stepRaci) {
    const list = stepsByProcess.get(row.processId) ?? [];
    list.push({
      raciResponsibleRoleId: row.raciResponsibleRoleId,
      raciAccountableRoleId: row.raciAccountableRoleId,
    });
    stepsByProcess.set(row.processId, list);
  }

  const overridesByProcess = new Map<string, RaciOverrideEntry[]>();
  for (const row of overrides) {
    const list = overridesByProcess.get(row.processId) ?? [];
    list.push({
      participantBpmnId: row.participantBpmnId,
      raciRole: row.raciRole,
    });
    overridesByProcess.set(row.processId, list);
  }

  // One acknowledgment per process: prefer the step of the currently
  // published version, fall back to the newest one.
  const ackByProcess = new Map<string, AckRow>();
  const currentVersionByProcess = new Map<string, number>(
    processes.map((p) => [p.id, p.currentVersion]),
  );
  for (const row of ackRows) {
    const existing = ackByProcess.get(row.processId);
    const currentVersion = currentVersionByProcess.get(row.processId);
    if (
      !existing ||
      (row.versionNumber === currentVersion &&
        existing.versionNumber !== currentVersion) ||
      (existing.versionNumber !== currentVersion &&
        row.versionNumber > existing.versionNumber)
    ) {
      ackByProcess.set(row.processId, row);
    }
  }

  const items: MyProcessListItem[] = processes
    .map((p) => {
      const myRoles = resolveMyProcessRoles({
        userId: ctx.userId,
        processOwnerId: p.processOwnerId,
        userCustomRoleIds: myRoleIds,
        stepRaci: stepsByProcess.get(p.id) ?? [],
        raciOverrides: overridesByProcess.get(p.id) ?? [],
      });
      const ack = ackByProcess.get(p.id);
      return {
        ...p,
        myRoles,
        acknowledgment: ack
          ? {
              stepId: ack.id,
              status: ack.status,
              dueDate: ack.dueDate,
              decidedAt: ack.decidedAt,
            }
          : null,
      };
    })
    .filter((item) => item.myRoles.length > 0 || item.acknowledgment !== null);

  return Response.json({ data: items });
}
