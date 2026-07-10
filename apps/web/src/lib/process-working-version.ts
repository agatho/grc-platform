// B2.4 (Release-Cycle): working-copy handling for published processes.
//
// While a process is published, editor saves land in a single 'working'
// version (overwritten on every save) — the released version and the
// process' released artifacts stay untouched. On re-approval the working
// copy is promoted to the next released version and becomes current.

import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { process, processVersion, processStep } from "@grc/db";
import { parseBpmnXml } from "@grc/shared";
import { rehydrateFromBpmnXml } from "@/lib/bpmn-arctos-rehydrate";

interface PromoteArgs {
  tx: any; // drizzle transaction (same convention as withAuditContext)
  processId: string;
  orgId: string;
  userId: string;
}

export interface PromotedVersion {
  id: string;
  versionNumber: number;
}

/** Return the working version of a process, if one exists. */
export async function findWorkingVersion(
  tx: any,
  processId: string,
): Promise<{
  id: string;
  versionNumber: number;
  bpmnXml: string | null;
} | null> {
  const [row] = await tx
    .select({
      id: processVersion.id,
      versionNumber: processVersion.versionNumber,
      bpmnXml: processVersion.bpmnXml,
    })
    .from(processVersion)
    .where(
      and(
        eq(processVersion.processId, processId),
        eq(processVersion.versionType, "working"),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Promote the working copy of a process to the next released version.
 *
 * - the working row becomes versionType 'released' + isCurrent
 * - process.currentVersion is advanced
 * - process_step records are re-synced from the promoted BPMN XML
 * - arctos:* cross-links are rehydrated (best-effort)
 *
 * Returns null when the process has no working copy.
 */
export async function promoteWorkingVersion({
  tx,
  processId,
  orgId,
  userId,
}: PromoteArgs): Promise<PromotedVersion | null> {
  const working = await findWorkingVersion(tx, processId);
  if (!working) return null;

  // Highest version number across all rows — the working row keeps its
  // number when it is already the highest, otherwise it is bumped past
  // any released version created in the meantime.
  const [maxRow] = await tx
    .select({
      max: sql<number>`COALESCE(MAX(${processVersion.versionNumber}), 0)`,
    })
    .from(processVersion)
    .where(eq(processVersion.processId, processId));
  const maxNumber = Number(maxRow?.max ?? 0);
  const finalNumber =
    working.versionNumber >= maxNumber ? working.versionNumber : maxNumber + 1;

  await tx
    .update(processVersion)
    .set({ isCurrent: false })
    .where(eq(processVersion.processId, processId));

  await tx
    .update(processVersion)
    .set({
      versionType: "released",
      isCurrent: true,
      versionNumber: finalNumber,
    })
    .where(eq(processVersion.id, working.id));

  await tx
    .update(process)
    .set({
      currentVersion: finalNumber,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(and(eq(process.id, processId), eq(process.orgId, orgId)));

  // Sync process_step records from the promoted XML (same semantics as the
  // save path in POST /processes/[id]/versions).
  if (working.bpmnXml) {
    try {
      const parsedSteps = parseBpmnXml(working.bpmnXml);

      const existingSteps = await tx
        .select({
          id: processStep.id,
          bpmnElementId: processStep.bpmnElementId,
        })
        .from(processStep)
        .where(
          and(
            eq(processStep.processId, processId),
            isNull(processStep.deletedAt),
          ),
        );

      const existingStepMap = new Map<string, string>(
        existingSteps.map((s: { bpmnElementId: string; id: string }) => [
          s.bpmnElementId,
          s.id,
        ]),
      );
      const parsedElementIds = new Set<string>(
        parsedSteps.map((s) => s.bpmnElementId),
      );

      for (const step of parsedSteps) {
        const existingId = existingStepMap.get(step.bpmnElementId);
        if (existingId) {
          await tx
            .update(processStep)
            .set({
              name: step.name,
              stepType: step.stepType,
              sequenceOrder: step.sequenceOrder,
              updatedAt: new Date(),
            })
            .where(eq(processStep.id, existingId));
        } else {
          await tx.insert(processStep).values({
            processId,
            orgId,
            bpmnElementId: step.bpmnElementId,
            name: step.name,
            stepType: step.stepType,
            sequenceOrder: step.sequenceOrder,
          });
        }
      }

      for (const [elementId, stepId] of existingStepMap) {
        if (!parsedElementIds.has(elementId)) {
          await tx
            .update(processStep)
            .set({ deletedAt: new Date() })
            .where(eq(processStep.id, stepId));
        }
      }

      // Rehydrate arctos:* cross-links — best-effort, never blocking.
      try {
        const allSteps = await tx
          .select({
            id: processStep.id,
            bpmnElementId: processStep.bpmnElementId,
          })
          .from(processStep)
          .where(
            and(
              eq(processStep.processId, processId),
              isNull(processStep.deletedAt),
            ),
          );
        const stepIdByBpmnElement = new Map<string, string>(
          allSteps.map(
            (s: { id: string; bpmnElementId: string }): [string, string] => [
              s.bpmnElementId,
              s.id,
            ],
          ),
        );
        await rehydrateFromBpmnXml({
          tx,
          processId,
          orgId,
          userId,
          bpmnXml: working.bpmnXml,
          stepIdByBpmnElement,
        });
      } catch (e) {
        console.error("arctos rehydrate failed on promote", e);
      }
    } catch (e) {
      // Step sync is best-effort on promotion; the version itself is
      // already released at this point.
      console.error("step sync failed on promote", e);
    }
  }

  return { id: working.id, versionNumber: finalNumber };
}

/**
 * Upsert the working copy of a published process. Returns the saved row.
 */
export async function upsertWorkingVersion({
  tx,
  processId,
  orgId,
  userId,
  currentVersion,
  bpmnXml,
  changeSummary,
  diffSummaryJson,
}: {
  tx: any;
  processId: string;
  orgId: string;
  userId: string;
  currentVersion: number;
  bpmnXml: string;
  changeSummary?: string | null;
  diffSummaryJson?: Record<string, unknown> | null;
}) {
  const existing = await findWorkingVersion(tx, processId);
  if (existing) {
    const [row] = await tx
      .update(processVersion)
      .set({
        bpmnXml,
        changeSummary: changeSummary ?? null,
        diffSummaryJson: diffSummaryJson ?? null,
        createdBy: userId,
        createdAt: new Date(),
      })
      .where(eq(processVersion.id, existing.id))
      .returning();
    return row;
  }

  const [maxRow] = await tx
    .select({
      max: sql<number>`COALESCE(MAX(${processVersion.versionNumber}), 0)`,
    })
    .from(processVersion)
    .where(eq(processVersion.processId, processId));
  const nextNumber = Math.max(Number(maxRow?.max ?? 0), currentVersion) + 1;

  const [row] = await tx
    .insert(processVersion)
    .values({
      processId,
      orgId,
      versionNumber: nextNumber,
      bpmnXml,
      changeSummary: changeSummary ?? null,
      diffSummaryJson: diffSummaryJson ?? null,
      isCurrent: false,
      versionType: "working",
      createdBy: userId,
    })
    .returning();
  return row;
}
