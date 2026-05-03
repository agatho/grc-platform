// POST /api/v1/programmes/reverse-from-finding
//
// Reverse-Programme: nimmt eine bestehende Audit-Finding (oder NC) und erzeugt
// daraus eine Mini-Programme-Journey zur strukturierten Behebung.
//
// Use-Case: Stage-2-Audit liefert "Major NC #4: Awareness-Training nicht alle
// Mitarbeiter erfasst" → System generiert sofort 3-Step-Programm:
//   1. Root-Cause-Analyse (5-Why)
//   2. Korrekturmaßnahme implementieren + Effectiveness-Test
//   3. Wirksamkeit verifizieren + NC schließen lassen
//
// Body: { findingId, findingTitle, severity, dueInDays?, ownerId? }

import {
  db,
  programmeJourney,
  programmeJourneyPhase,
  programmeJourneyStep,
  programmeJourneySubtask,
  programmeStepLink,
  programmeJourneyEvent,
  programmeTemplate,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { eq, and, isNull, asc } from "drizzle-orm";
import { z } from "zod";

const reverseSchema = z.object({
  findingId: z.string().uuid().optional(),
  findingTitle: z.string().min(2).max(300),
  severity: z.enum(["major", "minor", "observation"]).default("minor"),
  dueInDays: z.number().int().min(1).max(365).optional(),
  ownerId: z.string().uuid().optional(),
  description: z.string().max(5000).optional(),
});

export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("programme", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = reverseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Severity → defaults
  const dueInDays =
    parsed.data.dueInDays ??
    (parsed.data.severity === "major"
      ? 30
      : parsed.data.severity === "minor"
        ? 90
        : 180);
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setUTCDate(targetDate.getUTCDate() + dueInDays);

  // Use first available ISMS template as sentinel for FK
  const [tpl] = await db
    .select({ id: programmeTemplate.id, msType: programmeTemplate.msType })
    .from(programmeTemplate)
    .where(
      and(
        eq(programmeTemplate.isActive, true),
        isNull(programmeTemplate.deprecatedAt),
      ),
    )
    .orderBy(asc(programmeTemplate.createdAt))
    .limit(1);
  if (!tpl) {
    return Response.json(
      { error: "Need at least one programme template as sentinel" },
      { status: 500 },
    );
  }

  const journeyName = `Behebung: ${parsed.data.findingTitle}`.slice(0, 200);

  const result = await withAuditContext(ctx, async () => {
    // Create journey
    const [journey] = await db
      .insert(programmeJourney)
      .values({
        orgId: ctx.orgId,
        templateId: tpl.id,
        templateCode: "reverse-finding-mini",
        templateVersion: "1.0",
        msType: tpl.msType,
        name: journeyName,
        description:
          parsed.data.description ??
          `Auto-generiert aus Finding "${parsed.data.findingTitle}" (Severity: ${parsed.data.severity}). 3-Schritt-Plan: Root-Cause → Korrektur → Verifikation.`,
        status: "active",
        progressPercent: "0",
        ownerId: parsed.data.ownerId ?? ctx.userId,
        startedAt: today.toISOString().slice(0, 10),
        targetCompletionDate: targetDate.toISOString().slice(0, 10),
        metadata: {
          source: "reverse-from-finding",
          findingId: parsed.data.findingId,
          findingTitle: parsed.data.findingTitle,
          severity: parsed.data.severity,
        },
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Create one phase: "Behebung"
    const [phase] = await db
      .insert(programmeJourneyPhase)
      .values({
        orgId: ctx.orgId,
        journeyId: journey.id,
        templatePhaseId: null as unknown as string, // sentinel — relax FK
        code: "remediation",
        sequence: 0,
        name: "Behebung",
        pdcaPhase: "act",
        status: "in_progress",
        progressPercent: "0",
        plannedStartDate: today.toISOString().slice(0, 10),
        plannedEndDate: targetDate.toISOString().slice(0, 10),
      })
      .returning();

    // Use first template_step_id as FK sentinel
    const stepInsert = async (
      sequence: number,
      code: string,
      name: string,
      description: string,
      durationDays: number,
      sentinelTemplateStepId: string,
    ) => {
      const due = new Date(today);
      due.setUTCDate(due.getUTCDate() + durationDays);
      const [step] = await db
        .insert(programmeJourneyStep)
        .values({
          orgId: ctx.orgId,
          journeyId: journey.id,
          phaseId: phase.id,
          templateStepId: sentinelTemplateStepId,
          code,
          sequence,
          name,
          description,
          status: "pending",
          ownerId: parsed.data.ownerId ?? ctx.userId,
          dueDate: due.toISOString().slice(0, 10),
          evidenceLinks: [],
          targetModuleLink: { module: "isms", route: "/isms/nonconformities" },
          requiredEvidenceCount: 1,
          isMilestone: code === "RC-3",
          isMandatory: true,
          metadata: { custom: true, source: "reverse-from-finding" },
          updatedBy: ctx.userId,
        })
        .returning();
      return step;
    };

    // Need a sentinel template_step_id — get from template
    // Fallback: use template_id itself? No, programme_template_step is required.
    // Approach: query for any template step
    const sentinelRows = await db
      .select({ id: programmeJourneyStep.templateStepId })
      .from(programmeJourneyStep)
      .where(eq(programmeJourneyStep.orgId, ctx.orgId))
      .limit(1);
    const sentinelTplStepId = sentinelRows[0]?.id;
    if (!sentinelTplStepId) {
      throw new Error(
        "Cannot create reverse journey: no existing journey step in org (need any template_step as FK sentinel — create at least one normal journey first)",
      );
    }

    const step1 = await stepInsert(
      0,
      "RC-1",
      "Root-Cause-Analyse (5-Why)",
      "Strukturierte Ursachen-Analyse: nicht nur Symptom adressieren, sondern echte Ursache finden. Methoden: 5-Why, Ishikawa, Fault-Tree.",
      Math.max(7, Math.floor(dueInDays / 4)),
      sentinelTplStepId,
    );
    await db.insert(programmeJourneySubtask).values([
      {
        orgId: ctx.orgId,
        journeyStepId: step1.id,
        sequence: 1,
        title: "5-Why-Analyse durchführen",
        description:
          "Mit Owner und betroffenen Stakeholdern: 5x 'Warum?' fragen bis zur Root Cause.",
        status: "pending",
      },
      {
        orgId: ctx.orgId,
        journeyStepId: step1.id,
        sequence: 2,
        title: "Root-Cause dokumentieren",
        description:
          "Schriftliches Dokument im Documents-Modul. Wird Beleg für Auditor.",
        status: "pending",
        deliverableType: "evidence",
      },
    ]);

    const step2 = await stepInsert(
      1,
      "RC-2",
      "Korrekturmaßnahme implementieren + testen",
      "Konkrete Maßnahme zur Beseitigung der Root-Cause. Implementierung + erster Wirksamkeits-Test.",
      Math.max(14, Math.floor(dueInDays / 2)),
      sentinelTplStepId,
    );
    await db.insert(programmeJourneySubtask).values([
      {
        orgId: ctx.orgId,
        journeyStepId: step2.id,
        sequence: 1,
        title: "Maßnahme designen",
        description:
          "Welche konkrete Änderung an Prozess/Tool/Schulung adressiert die Root-Cause?",
        status: "pending",
      },
      {
        orgId: ctx.orgId,
        journeyStepId: step2.id,
        sequence: 2,
        title: "Maßnahme implementieren",
        description:
          "Umsetzung. Mit Owner-Pflicht. Monitoring der Implementation.",
        status: "pending",
        deliverableType: "control",
      },
      {
        orgId: ctx.orgId,
        journeyStepId: step2.id,
        sequence: 3,
        title: "Erster Wirksamkeits-Test",
        description: "Sicherstellen, dass die Maßnahme das adressierte Problem tatsächlich verhindert.",
        status: "pending",
        deliverableType: "evidence",
      },
    ]);

    const step3 = await stepInsert(
      2,
      "RC-3",
      "Wirksamkeit verifizieren + NC schließen",
      "Verifikation durch unabhängige Funktion (3rd Line oder Auditor) dass die Maßnahme wirkt und kein Re-Auftreten zu beobachten ist. Bei Erfolg: NC formal geschlossen.",
      dueInDays,
      sentinelTplStepId,
    );
    await db.insert(programmeJourneySubtask).values([
      {
        orgId: ctx.orgId,
        journeyStepId: step3.id,
        sequence: 1,
        title: "Verifikations-Audit (3rd Line)",
        description:
          "Unabhängige Prüfung: ist Root-Cause adressiert? Ist Maßnahme wirksam? Beleg-Sample.",
        status: "pending",
        deliverableType: "evidence",
      },
      {
        orgId: ctx.orgId,
        journeyStepId: step3.id,
        sequence: 2,
        title: "NC im Audit-Modul formell schließen",
        description: "Wenn Verifikation positiv: NC-Status auf 'closed', mit Cross-Link zu dieser Journey.",
        status: "pending",
      },
    ]);

    // If findingId given, create a step-link from RC-3 to the NC
    if (parsed.data.findingId) {
      await db.insert(programmeStepLink).values({
        orgId: ctx.orgId,
        journeyStepId: step3.id,
        targetKind: "finding",
        targetId: parsed.data.findingId,
        targetLabel: parsed.data.findingTitle,
        linkType: "deliverable",
        notes: "Original-Finding aus dem das Mini-Programm entstand",
        createdBy: ctx.userId,
      });
    }

    await db.insert(programmeJourneyEvent).values({
      orgId: ctx.orgId,
      journeyId: journey.id,
      eventType: "journey.reverse_created",
      actorId: ctx.userId,
      payload: {
        sourceFindingId: parsed.data.findingId,
        severity: parsed.data.severity,
        dueInDays,
      },
    });

    return { journey, stepIds: [step1.id, step2.id, step3.id] };
  });

  return Response.json({ data: result }, { status: 201 });
}
