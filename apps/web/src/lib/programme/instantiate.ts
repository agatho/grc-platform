// Programme Cockpit — Instanziierung einer Journey aus einem Template.
//
// Erzeugt programme_journey + alle programme_journey_phase + programme_journey_step
// in einer Transaktion. Berechnet planned_start / planned_end pro Phase
// basierend auf der Template-Sequenz und der gewünschten Start-Datum.

import {
  programmeJourney,
  programmeJourneyEvent,
  programmeJourneyPhase,
  programmeJourneyStep,
  programmeJourneySubtask,
  programmeTemplate,
  programmeTemplatePhase,
  programmeTemplateStep,
  programmeTemplateSubtask,
  type ProgrammeJourneyInsert,
} from "@grc/db";
import type { db as Db } from "@grc/db";
import { eq, asc, inArray } from "drizzle-orm";

type DbClient = typeof Db;

export interface InstantiateInput {
  orgId: string;
  templateId: string;
  name: string;
  description?: string | null;
  ownerId?: string | null;
  sponsorId?: string | null;
  startedAt?: string | null;
  targetCompletionDate?: string | null;
  metadata?: Record<string, unknown>;
  createdBy: string;
}

export interface InstantiateResult {
  journey: typeof programmeJourney.$inferSelect;
  phaseCount: number;
  stepCount: number;
  subtaskCount: number;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function instantiateJourney(
  db: DbClient,
  input: InstantiateInput,
): Promise<InstantiateResult> {
  const [tpl] = await db
    .select()
    .from(programmeTemplate)
    .where(eq(programmeTemplate.id, input.templateId))
    .limit(1);
  if (!tpl) {
    throw new Error(`Template not found: ${input.templateId}`);
  }
  if (!tpl.isActive || tpl.deprecatedAt) {
    throw new Error(`Template ${tpl.code}@${tpl.version} is not active.`);
  }

  const tplPhases = await db
    .select()
    .from(programmeTemplatePhase)
    .where(eq(programmeTemplatePhase.templateId, tpl.id))
    .orderBy(asc(programmeTemplatePhase.sequence));

  const tplSteps = await db
    .select()
    .from(programmeTemplateStep)
    .where(eq(programmeTemplateStep.templateId, tpl.id))
    .orderBy(asc(programmeTemplateStep.sequence));

  const startISO = input.startedAt ?? new Date().toISOString().slice(0, 10);

  const journeyValues: ProgrammeJourneyInsert = {
    orgId: input.orgId,
    templateId: tpl.id,
    templateCode: tpl.code,
    templateVersion: tpl.version,
    msType: tpl.msType,
    name: input.name,
    description: input.description ?? null,
    status: "planned",
    progressPercent: "0",
    ownerId: input.ownerId ?? null,
    sponsorId: input.sponsorId ?? null,
    startedAt: input.startedAt ?? null,
    targetCompletionDate:
      input.targetCompletionDate ??
      addDays(startISO, tpl.estimatedDurationDays),
    metadata: input.metadata ?? {},
    createdBy: input.createdBy,
    updatedBy: input.createdBy,
  };

  const [journey] = await db
    .insert(programmeJourney)
    .values(journeyValues)
    .returning();

  // Phases mit kumulierter Start-/End-Berechnung
  const phaseCodeToId = new Map<string, string>();
  let cursor = startISO;
  for (const p of tplPhases) {
    const plannedStart = cursor;
    const plannedEnd = addDays(plannedStart, p.defaultDurationDays);
    const [phaseRow] = await db
      .insert(programmeJourneyPhase)
      .values({
        orgId: input.orgId,
        journeyId: journey.id,
        templatePhaseId: p.id,
        code: p.code,
        sequence: p.sequence,
        name: p.name,
        pdcaPhase: p.pdcaPhase,
        status: "pending",
        progressPercent: "0",
        plannedStartDate: plannedStart,
        plannedEndDate: plannedEnd,
      })
      .returning();
    phaseCodeToId.set(p.code, phaseRow.id);
    cursor = plannedEnd;
  }

  // Steps in dieselbe Phase einsortieren
  // Berechne pro Phase einen schritt-spezifischen due_date kumulativ.
  const stepDueByCode: Record<string, string> = {};
  const phaseStartByPhaseId: Record<string, string> = {};
  for (const p of tplPhases) {
    const id = phaseCodeToId.get(p.code);
    if (id) phaseStartByPhaseId[id] = startISO; // overwritten below
  }
  // recompute proper phase starts from journey rows we just inserted
  const insertedPhases = await db
    .select()
    .from(programmeJourneyPhase)
    .where(eq(programmeJourneyPhase.journeyId, journey.id))
    .orderBy(asc(programmeJourneyPhase.sequence));
  for (const p of insertedPhases) {
    phaseStartByPhaseId[p.id] = p.plannedStartDate ?? startISO;
  }

  const phaseCursor: Record<string, string> = { ...phaseStartByPhaseId };

  const journeyStepByTemplateStepId = new Map<string, { id: string; dueDate: string }>();
  for (const s of tplSteps) {
    const journeyPhaseId = phaseCodeToId.get(
      tplPhases.find((p) => p.id === s.phaseId)?.code ?? "",
    );
    if (!journeyPhaseId) continue;

    const start = phaseCursor[journeyPhaseId] ?? startISO;
    const due = addDays(start, s.defaultDurationDays);
    phaseCursor[journeyPhaseId] = due;
    stepDueByCode[s.code] = due;

    const [stepRow] = await db
      .insert(programmeJourneyStep)
      .values({
        orgId: input.orgId,
        journeyId: journey.id,
        phaseId: journeyPhaseId,
        templateStepId: s.id,
        code: s.code,
        sequence: s.sequence,
        name: s.name,
        description: s.description ?? null,
        isoClause: s.isoClause ?? null,
        status: "pending",
        ownerId: input.ownerId ?? null,
        dueDate: due,
        evidenceLinks: [],
        targetModuleLink: s.targetModuleLink ?? {},
        requiredEvidenceCount: s.requiredEvidenceCount ?? 0,
        isMilestone: s.isMilestone ?? false,
        isMandatory: s.isMandatory ?? true,
      })
      .returning();
    journeyStepByTemplateStepId.set(s.id, { id: stepRow.id, dueDate: due });
  }

  // Subtasks aus Template kopieren — pro Schritt mit kumulativen Due-Dates.
  let subtaskCount = 0;
  if (tplSteps.length > 0) {
    const tplSubtasks = await db
      .select()
      .from(programmeTemplateSubtask)
      .where(
        inArray(
          programmeTemplateSubtask.templateStepId,
          tplSteps.map((s) => s.id),
        ),
      )
      .orderBy(asc(programmeTemplateSubtask.sequence));
    if (tplSubtasks.length > 0) {
      const subtaskRows = tplSubtasks
        .map((sub) => {
          const journeyStep = journeyStepByTemplateStepId.get(sub.templateStepId);
          if (!journeyStep) return null;
          return {
            orgId: input.orgId,
            journeyStepId: journeyStep.id,
            templateSubtaskId: sub.id,
            sequence: sub.sequence,
            title: sub.title,
            description: sub.description,
            status: "pending" as const,
            ownerId: null,
            dueDate: journeyStep.dueDate,
            isMandatory: sub.isMandatory,
            deliverableType: sub.deliverableType,
          };
        })
        .filter(
          (r): r is NonNullable<typeof r> => r !== null,
        );
      if (subtaskRows.length > 0) {
        await db.insert(programmeJourneySubtask).values(subtaskRows);
        subtaskCount = subtaskRows.length;
      }
    }
  }

  await db.insert(programmeJourneyEvent).values({
    orgId: input.orgId,
    journeyId: journey.id,
    eventType: "journey.created",
    actorId: input.createdBy,
    payload: {
      templateCode: tpl.code,
      templateVersion: tpl.version,
      phaseCount: tplPhases.length,
      stepCount: tplSteps.length,
      subtaskCount,
    },
  });

  return {
    journey,
    phaseCount: tplPhases.length,
    stepCount: tplSteps.length,
    subtaskCount,
  };
}
