// Cron Job: Programme Cockpit — Wöchentlicher Progress-Snapshot
//
// Schreibt einen Snapshot des aktuellen progress_percent in den Event-Log,
// damit Trend-Analysen über die Zeit möglich sind. Frequenz: wöchentlich Mo 07:00.

import {
  db,
  programmeJourney,
  programmeJourneyEvent,
  programmeJourneyStep,
} from "@grc/db";
import { and, eq, isNull } from "drizzle-orm";

interface ProgrammeProgressSnapshotResult {
  journeysSnapshot: number;
}

export async function processProgrammeProgressSnapshot(): Promise<ProgrammeProgressSnapshotResult> {
  const now = new Date();
  console.log(
    `[cron:programme-progress-snapshot] Starting at ${now.toISOString()}`,
  );

  const journeys = await db
    .select({
      id: programmeJourney.id,
      orgId: programmeJourney.orgId,
      status: programmeJourney.status,
      progressPercent: programmeJourney.progressPercent,
    })
    .from(programmeJourney)
    .where(isNull(programmeJourney.deletedAt));

  let snapshots = 0;

  for (const j of journeys) {
    const steps = await db
      .select({ status: programmeJourneyStep.status })
      .from(programmeJourneyStep)
      .where(
        and(
          eq(programmeJourneyStep.journeyId, j.id),
          eq(programmeJourneyStep.orgId, j.orgId),
        ),
      );

    const counts = {
      total: steps.length,
      pending: steps.filter((s) => s.status === "pending").length,
      in_progress: steps.filter((s) => s.status === "in_progress").length,
      review: steps.filter((s) => s.status === "review").length,
      blocked: steps.filter((s) => s.status === "blocked").length,
      completed: steps.filter((s) => s.status === "completed").length,
      skipped: steps.filter((s) => s.status === "skipped").length,
      cancelled: steps.filter((s) => s.status === "cancelled").length,
    };

    await db.insert(programmeJourneyEvent).values({
      orgId: j.orgId,
      journeyId: j.id,
      eventType: "journey.progress_snapshot",
      actorId: null,
      payload: {
        progressPercent: j.progressPercent,
        status: j.status,
        counts,
        snapshotAt: now.toISOString(),
      },
    });
    snapshots++;
  }

  console.log(
    `[cron:programme-progress-snapshot] Wrote ${snapshots} snapshots.`,
  );
  return { journeysSnapshot: snapshots };
}
