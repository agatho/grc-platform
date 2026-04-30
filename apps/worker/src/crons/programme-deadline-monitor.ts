// Cron Job: Programme Cockpit — Deadline-Monitor
//
// Findet Schritte, deren due_date überschritten ist, ohne dass sie bereits
// completed/skipped/cancelled sind, und benachrichtigt den jeweiligen Owner
// (oder den Journey-Owner falls kein Step-Owner zugewiesen ist).
//
// Frequenz: täglich 06:00.

import {
  db,
  notification,
  programmeJourney,
  programmeJourneyEvent,
  programmeJourneyStep,
} from "@grc/db";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";

interface ProgrammeDeadlineResult {
  stepsScanned: number;
  notificationsCreated: number;
  eventsCreated: number;
}

export async function processProgrammeDeadlineMonitor(): Promise<ProgrammeDeadlineResult> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  let notified = 0;
  let events = 0;

  console.log(
    `[cron:programme-deadline-monitor] Starting at ${now.toISOString()}`,
  );

  // Schritte mit überschrittenem due_date in noch aktiven Status
  const overdue = await db
    .select({
      id: programmeJourneyStep.id,
      orgId: programmeJourneyStep.orgId,
      journeyId: programmeJourneyStep.journeyId,
      code: programmeJourneyStep.code,
      name: programmeJourneyStep.name,
      ownerId: programmeJourneyStep.ownerId,
      dueDate: programmeJourneyStep.dueDate,
    })
    .from(programmeJourneyStep)
    .where(
      and(
        or(
          eq(programmeJourneyStep.status, "pending"),
          eq(programmeJourneyStep.status, "in_progress"),
          eq(programmeJourneyStep.status, "review"),
          eq(programmeJourneyStep.status, "blocked"),
        ),
        lt(programmeJourneyStep.dueDate, today),
      ),
    );

  if (overdue.length === 0) {
    console.log("[cron:programme-deadline-monitor] No overdue steps found.");
    return { stepsScanned: 0, notificationsCreated: 0, eventsCreated: 0 };
  }

  // Journey-Owner als Fallback, gruppiert nach journeyId
  const journeyIds = Array.from(new Set(overdue.map((s) => s.journeyId)));
  const journeys = await db
    .select({
      id: programmeJourney.id,
      ownerId: programmeJourney.ownerId,
      name: programmeJourney.name,
    })
    .from(programmeJourney)
    .where(
      and(
        inArray(programmeJourney.id, journeyIds),
        isNull(programmeJourney.deletedAt),
      ),
    );
  const journeyOwnerById = new Map<
    string,
    { ownerId: string | null; name: string }
  >();
  for (const j of journeys) {
    journeyOwnerById.set(j.id, { ownerId: j.ownerId, name: j.name });
  }

  for (const s of overdue) {
    try {
      const journeyMeta = journeyOwnerById.get(s.journeyId);
      const recipient = s.ownerId ?? journeyMeta?.ownerId ?? null;
      if (recipient) {
        const dueMs = Date.parse(s.dueDate + "T00:00:00Z");
        const overdueDays = Math.floor((now.getTime() - dueMs) / 86_400_000);
        await db.insert(notification).values({
          userId: recipient,
          orgId: s.orgId,
          type: "deadline_approaching" as const,
          entityType: "programme_journey_step",
          entityId: s.id,
          title: `Programmschritt überfällig: ${s.name}`,
          message: `Schritt "${s.name}" ist seit ${overdueDays} Tag(en) überfällig (${s.dueDate}).`,
          channel: "both" as const,
          templateKey: "programme_step_overdue",
          templateData: {
            stepName: s.name,
            stepCode: s.code,
            dueDate: s.dueDate,
            overdueDays,
            journeyName: journeyMeta?.name ?? "",
            journeyId: s.journeyId,
          },
          createdAt: now,
          updatedAt: now,
        });
        notified++;
      }

      await db.insert(programmeJourneyEvent).values({
        orgId: s.orgId,
        journeyId: s.journeyId,
        stepId: s.id,
        eventType: "step.overdue_detected",
        actorId: null,
        payload: { dueDate: s.dueDate, code: s.code },
      });
      events++;
    } catch (err) {
      console.error(
        `[cron:programme-deadline-monitor] failed for step ${s.id}:`,
        (err as Error).message,
      );
    }
  }

  console.log(
    `[cron:programme-deadline-monitor] Scanned ${overdue.length} overdue steps; created ${notified} notifications, ${events} events.`,
  );
  return {
    stepsScanned: overdue.length,
    notificationsCreated: notified,
    eventsCreated: events,
  };
}
