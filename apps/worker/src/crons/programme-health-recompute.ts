// Cron Job: Programme Cockpit — Health-Recompute
//
// Iteriert alle aktiven Journeys einer Org, lädt Step-Aggregates und
// aktualisiert programme_journey.status / progress_percent / last_health_eval_at.
//
// Frequenz: stündlich.

import {
  db,
  programmeJourney,
  programmeJourneyEvent,
  programmeJourneyPhase,
  programmeJourneyStep,
} from "@grc/db";
import {
  computeJourneyProgress,
  evaluateJourneyHealth,
  type ProgrammeJourneyStatus,
} from "@grc/shared";
import { and, eq, isNull, inArray } from "drizzle-orm";

interface ProgrammeHealthResult {
  journeysProcessed: number;
  statusChanges: number;
  errors: number;
}

const TODAY = (): string => new Date().toISOString().slice(0, 10);

export async function processProgrammeHealthRecompute(): Promise<ProgrammeHealthResult> {
  const now = new Date();
  console.log(
    `[cron:programme-health-recompute] Starting at ${now.toISOString()}`,
  );

  const activeStates: ProgrammeJourneyStatus[] = [
    "active",
    "on_track",
    "at_risk",
    "blocked",
  ];

  const journeys = await db
    .select()
    .from(programmeJourney)
    .where(
      and(
        inArray(programmeJourney.status, activeStates),
        isNull(programmeJourney.deletedAt),
      ),
    );

  if (journeys.length === 0) {
    console.log("[cron:programme-health-recompute] No active journeys.");
    return { journeysProcessed: 0, statusChanges: 0, errors: 0 };
  }

  let statusChanges = 0;
  let errors = 0;
  const today = TODAY();

  for (const journey of journeys) {
    try {
      const steps = await db
        .select({
          status: programmeJourneyStep.status,
          dueDate: programmeJourneyStep.dueDate,
          ownerId: programmeJourneyStep.ownerId,
          isMandatory: programmeJourneyStep.isMandatory,
        })
        .from(programmeJourneyStep)
        .where(eq(programmeJourneyStep.journeyId, journey.id));

      let completed = 0;
      let skipped = 0;
      let inProg = 0;
      let review = 0;
      let blocked = 0;
      let overdue = 0;
      let unassignedMandatory = 0;
      for (const s of steps) {
        if (s.status === "completed") completed++;
        else if (s.status === "skipped") skipped++;
        else if (s.status === "in_progress") inProg++;
        else if (s.status === "review") review++;
        else if (s.status === "blocked") blocked++;
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

      const health = evaluateJourneyHealth({
        totalSteps: steps.length,
        completedSteps: completed,
        inProgressSteps: inProg,
        blockedSteps: blocked,
        overdueSteps: overdue,
        unassignedMandatorySteps: unassignedMandatory,
      });

      const progress = computeJourneyProgress({
        totalSteps: steps.length,
        completedSteps: completed,
        skippedSteps: skipped,
        inProgressSteps: inProg,
        reviewSteps: review,
      });

      const nextStatus: ProgrammeJourneyStatus = health.derivedStatus;
      const statusChanged = nextStatus !== journey.status;

      await db
        .update(programmeJourney)
        .set({
          status: nextStatus,
          healthReason: health.reason,
          progressPercent: progress.toFixed(2),
          lastHealthEvalAt: now,
          updatedAt: now,
          actualCompletionDate:
            nextStatus === "completed" && !journey.actualCompletionDate
              ? today
              : journey.actualCompletionDate,
        })
        .where(eq(programmeJourney.id, journey.id));

      // Phasen-Progress synchronisieren
      const phases = await db
        .select()
        .from(programmeJourneyPhase)
        .where(eq(programmeJourneyPhase.journeyId, journey.id));
      for (const phase of phases) {
        const phaseSteps = await db
          .select({ status: programmeJourneyStep.status })
          .from(programmeJourneyStep)
          .where(eq(programmeJourneyStep.phaseId, phase.id));
        if (phaseSteps.length === 0) continue;
        const c = phaseSteps.filter(
          (s) => s.status === "completed" || s.status === "skipped",
        ).length;
        const p = phaseSteps.filter(
          (s) => s.status === "in_progress" || s.status === "review",
        ).length;
        const b = phaseSteps.filter((s) => s.status === "blocked").length;
        const pct =
          Math.round(((c + p * 0.5) / phaseSteps.length) * 10000) / 100;
        let phaseStatus = "pending";
        if (c === phaseSteps.length) phaseStatus = "completed";
        else if (b > 0) phaseStatus = "blocked";
        else if (c + p > 0) phaseStatus = "in_progress";
        await db
          .update(programmeJourneyPhase)
          .set({
            progressPercent: pct.toFixed(2),
            status: phaseStatus,
            updatedAt: now,
          })
          .where(eq(programmeJourneyPhase.id, phase.id));
      }

      if (statusChanged) {
        statusChanges++;
        await db.insert(programmeJourneyEvent).values({
          orgId: journey.orgId,
          journeyId: journey.id,
          eventType: "journey.health_status_changed",
          actorId: null,
          payload: {
            from: journey.status,
            to: nextStatus,
            reason: health.reason,
          },
        });
      }
    } catch (err) {
      errors++;
      console.error(
        `[cron:programme-health-recompute] failed for journey ${journey.id}:`,
        (err as Error).message,
      );
    }
  }

  console.log(
    `[cron:programme-health-recompute] Processed ${journeys.length} journeys, ${statusChanges} status-changes, ${errors} errors.`,
  );
  return { journeysProcessed: journeys.length, statusChanges, errors };
}
