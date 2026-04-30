// Programme Cockpit — Helpers für Health-Recompute, Progress-Recompute und
// Aggregations-Berechnungen.

import {
  db,
  programmeJourney,
  programmeJourneyPhase,
  programmeJourneyStep,
} from "@grc/db";
import {
  evaluateJourneyHealth,
  computeJourneyProgress,
  type ProgrammeJourneyStatus,
} from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";

export interface JourneyAggregates {
  totalSteps: number;
  completedSteps: number;
  skippedSteps: number;
  inProgressSteps: number;
  reviewSteps: number;
  blockedSteps: number;
  pendingSteps: number;
  cancelledSteps: number;
  overdueSteps: number;
  unassignedMandatorySteps: number;
}

const TODAY_ISO = (): string => new Date().toISOString().slice(0, 10);

export async function loadStepAggregates(
  journeyId: string,
  orgId: string,
): Promise<JourneyAggregates> {
  const steps = await db
    .select({
      status: programmeJourneyStep.status,
      dueDate: programmeJourneyStep.dueDate,
      ownerId: programmeJourneyStep.ownerId,
      isMandatory: programmeJourneyStep.isMandatory,
    })
    .from(programmeJourneyStep)
    .where(
      and(
        eq(programmeJourneyStep.journeyId, journeyId),
        eq(programmeJourneyStep.orgId, orgId),
      ),
    );

  const today = TODAY_ISO();
  let completed = 0;
  let skipped = 0;
  let inProg = 0;
  let review = 0;
  let blocked = 0;
  let pending = 0;
  let cancelled = 0;
  let overdue = 0;
  let unassignedMandatory = 0;

  for (const s of steps) {
    switch (s.status) {
      case "completed":
        completed++;
        break;
      case "skipped":
        skipped++;
        break;
      case "in_progress":
        inProg++;
        break;
      case "review":
        review++;
        break;
      case "blocked":
        blocked++;
        break;
      case "pending":
        pending++;
        break;
      case "cancelled":
        cancelled++;
        break;
    }

    if (
      s.status !== "completed" &&
      s.status !== "skipped" &&
      s.status !== "cancelled" &&
      s.dueDate &&
      s.dueDate < today
    ) {
      overdue++;
    }

    if (
      s.isMandatory &&
      s.ownerId == null &&
      s.status !== "completed" &&
      s.status !== "skipped" &&
      s.status !== "cancelled"
    ) {
      unassignedMandatory++;
    }
  }

  return {
    totalSteps: steps.length,
    completedSteps: completed,
    skippedSteps: skipped,
    inProgressSteps: inProg,
    reviewSteps: review,
    blockedSteps: blocked,
    pendingSteps: pending,
    cancelledSteps: cancelled,
    overdueSteps: overdue,
    unassignedMandatorySteps: unassignedMandatory,
  };
}

export interface HealthRecomputeOutput {
  derivedStatus: ProgrammeJourneyStatus;
  reason: string;
  healthScore: number;
  progressPercent: number;
  signals: ReturnType<typeof evaluateJourneyHealth>["signals"];
  aggregates: JourneyAggregates;
}

/**
 * Berechnet derived status (on_track | at_risk | blocked | completed) und
 * progress_percent neu. Persistiert das Ergebnis (atomar) und liefert die
 * neuen Werte zurück.
 *
 * Rein lesende Berechnung möglich via `persist=false`.
 */
export async function recomputeJourneyHealth(input: {
  orgId: string;
  journeyId: string;
  persist?: boolean;
}): Promise<HealthRecomputeOutput | null> {
  const { orgId, journeyId } = input;
  const persist = input.persist ?? true;

  const [journey] = await db
    .select()
    .from(programmeJourney)
    .where(
      and(
        eq(programmeJourney.id, journeyId),
        eq(programmeJourney.orgId, orgId),
        isNull(programmeJourney.deletedAt),
      ),
    )
    .limit(1);
  if (!journey) return null;

  const aggregates = await loadStepAggregates(journeyId, orgId);

  const health = evaluateJourneyHealth({
    totalSteps: aggregates.totalSteps,
    completedSteps: aggregates.completedSteps,
    inProgressSteps: aggregates.inProgressSteps,
    blockedSteps: aggregates.blockedSteps,
    overdueSteps: aggregates.overdueSteps,
    unassignedMandatorySteps: aggregates.unassignedMandatorySteps,
  });

  const progress = computeJourneyProgress({
    totalSteps: aggregates.totalSteps,
    completedSteps: aggregates.completedSteps,
    skippedSteps: aggregates.skippedSteps,
    inProgressSteps: aggregates.inProgressSteps,
    reviewSteps: aggregates.reviewSteps,
  });

  // Mappe derivedStatus zurück auf programmeJourneyStatus.
  // - Wenn Status `planned` oder `archived` ist: nicht überschreiben.
  // - Sonst: `on_track | at_risk | blocked | completed` setzen.
  let nextStatus: ProgrammeJourneyStatus = journey.status;
  if (journey.status !== "planned" && journey.status !== "archived") {
    nextStatus = health.derivedStatus;
  }

  if (persist) {
    await db
      .update(programmeJourney)
      .set({
        status: nextStatus,
        healthReason: health.reason,
        progressPercent: progress.toFixed(2),
        lastHealthEvalAt: new Date(),
        updatedAt: new Date(),
        actualCompletionDate:
          health.derivedStatus === "completed" && !journey.actualCompletionDate
            ? new Date().toISOString().slice(0, 10)
            : journey.actualCompletionDate,
      })
      .where(eq(programmeJourney.id, journeyId));

    // Phasen-Progress synchronisieren
    await recomputePhaseProgress(journeyId, orgId);
  }

  return {
    derivedStatus: nextStatus,
    reason: health.reason,
    healthScore: health.healthScore,
    progressPercent: progress,
    signals: health.signals,
    aggregates,
  };
}

async function recomputePhaseProgress(journeyId: string, orgId: string) {
  const phases = await db
    .select()
    .from(programmeJourneyPhase)
    .where(
      and(
        eq(programmeJourneyPhase.journeyId, journeyId),
        eq(programmeJourneyPhase.orgId, orgId),
      ),
    );

  for (const phase of phases) {
    const steps = await db
      .select({
        status: programmeJourneyStep.status,
      })
      .from(programmeJourneyStep)
      .where(
        and(
          eq(programmeJourneyStep.phaseId, phase.id),
          eq(programmeJourneyStep.orgId, orgId),
        ),
      );

    if (steps.length === 0) continue;
    const completed = steps.filter(
      (s) => s.status === "completed" || s.status === "skipped",
    ).length;
    const inProg = steps.filter(
      (s) => s.status === "in_progress" || s.status === "review",
    ).length;
    const blocked = steps.filter((s) => s.status === "blocked").length;
    const pct =
      Math.round(
        ((completed + inProg * 0.5) / steps.length) * 10000,
      ) / 100;

    let phaseStatus = "pending";
    if (completed === steps.length) phaseStatus = "completed";
    else if (blocked > 0) phaseStatus = "blocked";
    else if (completed + inProg > 0) phaseStatus = "in_progress";

    await db
      .update(programmeJourneyPhase)
      .set({
        progressPercent: pct.toFixed(2),
        status: phaseStatus,
        updatedAt: new Date(),
      })
      .where(eq(programmeJourneyPhase.id, phase.id));
  }
}
