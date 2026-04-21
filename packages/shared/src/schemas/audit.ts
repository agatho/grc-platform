import { z } from "zod";

// Sprint 8: Audit Management schemas

const auditTypeValues = [
  "internal",
  "external",
  "certification",
  "surveillance",
  "follow_up",
] as const;
const auditStatusValues = [
  "planned",
  "preparation",
  "fieldwork",
  "reporting",
  "review",
  "completed",
  "cancelled",
] as const;
const auditPlanStatusValues = [
  "draft",
  "approved",
  "active",
  "completed",
] as const;
// ISO 19011 § 3.4 / ISO/IEC 17021-1 § 9.4.8 — DAkkS-/TÜV-Praxisstandard.
// positive                    — Positive Feststellung / Commendation
// conforming                  — Konform (erfüllt Kriterium)
// opportunity_for_improvement — Hinweis / OFI (nicht bindend)
// observation                 — Feststellung / Beobachtung
// minor_nonconformity         — Nebenabweichung (isolierter Einzelfall)
// major_nonconformity         — Hauptabweichung (systemisches Versagen)
// nonconforming               — [DEPRECATED] Legacy, wird auf Minor NC gemappt
// not_applicable              — N/A (Kriterium nicht anwendbar)
export const checklistResultValues = [
  "positive",
  "conforming",
  "opportunity_for_improvement",
  "observation",
  "minor_nonconformity",
  "major_nonconformity",
  "nonconforming",
  "not_applicable",
] as const;
export type ChecklistResultValue = (typeof checklistResultValues)[number];

export const auditMethodValues = [
  "interview",
  "document_review",
  "observation",
  "technical_test",
  "sampling",
  "walkthrough",
  "reperformance",
] as const;
export type AuditMethodValue = (typeof auditMethodValues)[number];

export const auditRiskRatingValues = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type AuditRiskRatingValue = (typeof auditRiskRatingValues)[number];
const auditConclusionValues = [
  "conforming",
  "minor_nonconformity",
  "major_nonconformity",
  "not_applicable",
] as const;
const universeEntityTypeValues = [
  "process",
  "department",
  "it_system",
  "vendor",
  "custom",
] as const;
const checklistSourceTypeValues = [
  "auto_controls",
  "template",
  "custom",
] as const;

// ─── Audit Status Transitions ────────────────────────────────

export const VALID_AUDIT_STATUS_TRANSITIONS: Record<string, string[]> = {
  planned: ["preparation", "cancelled"],
  preparation: ["fieldwork", "planned", "cancelled"],
  fieldwork: ["reporting", "cancelled"],
  reporting: ["review", "cancelled"],
  review: ["completed", "reporting"],
  completed: [],
  cancelled: [],
};

export function isValidAuditTransition(from: string, to: string): boolean {
  return VALID_AUDIT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Audit Universe Entry ────────────────────────────────────

export const createAuditUniverseEntrySchema = z.object({
  name: z.string().min(1).max(500),
  entityType: z.enum(universeEntityTypeValues),
  entityId: z.string().uuid().optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
  lastAuditDate: z.string().optional(),
  auditCycleMonths: z.number().int().min(1).max(120).default(12),
  nextAuditDue: z.string().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
});

export const updateAuditUniverseEntrySchema =
  createAuditUniverseEntrySchema.partial();

// ─── Audit Plan ──────────────────────────────────────────────

export const createAuditPlanSchema = z.object({
  name: z.string().min(1).max(500),
  year: z.number().int().min(2020).max(2100),
  description: z.string().optional(),
  totalPlannedDays: z.number().int().positive().optional(),
});

export const updateAuditPlanSchema = createAuditPlanSchema.partial();

// ─── Audit Plan Item ─────────────────────────────────────────

export const createAuditPlanItemSchema = z.object({
  auditPlanId: z.string().uuid(),
  universeEntryId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  scopeDescription: z.string().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  estimatedDays: z.number().int().positive().optional(),
  leadAuditorId: z.string().uuid().optional(),
});

// ─── Audit ───────────────────────────────────────────────────

export const createAuditSchema = z.object({
  auditPlanItemId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  auditType: z.enum(auditTypeValues).default("internal"),
  scopeDescription: z.string().optional(),
  scopeProcesses: z.array(z.string()).optional(),
  scopeDepartments: z.array(z.string()).optional(),
  scopeFrameworks: z.array(z.string()).optional(),
  leadAuditorId: z.string().uuid().optional(),
  auditorIds: z.array(z.string().uuid()).optional(),
  auditeeId: z.string().uuid().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
});

export const updateAuditSchema = createAuditSchema.partial();

export const auditStatusTransitionSchema = z.object({
  status: z.enum(auditStatusValues),
  conclusion: z.enum(auditConclusionValues).optional(),
});

// ─── Audit Checklist ─────────────────────────────────────────

export const createAuditChecklistSchema = z.object({
  auditId: z.string().uuid(),
  name: z.string().min(1).max(500),
  sourceType: z.enum(checklistSourceTypeValues).optional(),
});

// ─── Checklist Item Evaluation ───────────────────────────────
// ISO 19011 § 6.4.5/6.4.7 + ISO/IEC 17021-1 § 9.4.7: prüfungssicheres
// Audit-Arbeitspapier. Notes allein ist kein Arbeitspapier — daher pflegen
// wir Kriterium, Methode, Interviewpartner, Stichprobe, Risiko-Rating,
// Korrekturmaßnahmen-Vorschlag und Frist separat.

// ── Method-Entries (ISO 19011 § 6.4.5/6.4.7) ────────────────
// Jeder Entry = ein Nachweis. Entries werden als Array gespeichert, weil
// dieselbe Bewertung oft mehrere Nachweise mit je eigenen Details verlangt
// (Interview MIT Person A + Dokumentenprüfung VON Policy X + Stichprobe
// AUS Ticket-System). Ein flaches Methoden-Array (0291) wurde vom User als
// oberflächlich abgelehnt — ISO-konforme Arbeitspapiere brauchen die
// methoden-spezifischen Detailfelder direkt am Nachweis.

const baseMethodFields = {
  id: z.string().min(1), // Client-side UUID, damit React-Keys stabil bleiben
  // YYYY-MM-DD, optional — nicht jeder Nachweis hat ein Datum
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(4000).optional(),
};

export const methodEntryInterviewSchema = z.object({
  ...baseMethodFields,
  method: z.literal("interview"),
  interviewee: z.string().max(200).optional(),
  intervieweeRole: z.string().max(200).optional(),
});

export const methodEntryDocumentReviewSchema = z.object({
  ...baseMethodFields,
  method: z.literal("document_review"),
  documents: z
    .array(
      z.object({
        title: z.string().min(1).max(500),
        reference: z.string().max(200).optional(),
        version: z.string().max(50).optional(),
      }),
    )
    .max(50)
    .optional(),
});

export const methodEntryObservationSchema = z.object({
  ...baseMethodFields,
  method: z.literal("observation"),
  location: z.string().max(200).optional(),
  observedProcess: z.string().max(500).optional(),
});

export const methodEntryWalkthroughSchema = z.object({
  ...baseMethodFields,
  method: z.literal("walkthrough"),
  process: z.string().max(500).optional(),
  participants: z.string().max(500).optional(),
});

export const methodEntryTechnicalTestSchema = z.object({
  ...baseMethodFields,
  method: z.literal("technical_test"),
  system: z.string().max(200).optional(),
  testDescription: z.string().max(2000).optional(),
  testResult: z.string().max(2000).optional(),
});

export const methodEntrySamplingSchema = z.object({
  ...baseMethodFields,
  method: z.literal("sampling"),
  populationSize: z.number().int().nonnegative().optional(),
  sampleSize: z.number().int().nonnegative().optional(),
  sampleIds: z.array(z.string().max(200)).max(500).optional(),
  selectionMethod: z.string().max(200).optional(),
});

export const methodEntryReperformanceSchema = z.object({
  ...baseMethodFields,
  method: z.literal("reperformance"),
  activity: z.string().max(500).optional(),
  baseline: z.string().max(500).optional(),
});

export const methodEntrySchema = z.discriminatedUnion("method", [
  methodEntryInterviewSchema,
  methodEntryDocumentReviewSchema,
  methodEntryObservationSchema,
  methodEntryWalkthroughSchema,
  methodEntryTechnicalTestSchema,
  methodEntrySamplingSchema,
  methodEntryReperformanceSchema,
]);
// `MethodEntry`-Typ lebt in `types/audit.ts` (Interface-Union) —
// hier nicht re-exportieren um Barrel-Kollision zu vermeiden.
export type MethodEntryFromSchema = z.infer<typeof methodEntrySchema>;

// ── Checklist-Item-Bewertung ─────────────────────────────────
export const evaluateChecklistItemSchema = z.object({
  result: z.enum(checklistResultValues),
  notes: z.string().optional(),
  evidenceIds: z.array(z.string().uuid()).optional(),

  criterionReference: z.string().max(200).optional(),
  methodEntries: z.array(methodEntrySchema).max(20).optional(),

  riskRating: z.enum(auditRiskRatingValues).optional(),
  correctiveActionSuggestion: z.string().max(4000).optional(),
  // YYYY-MM-DD — DB-Spalte ist date, nicht timestamptz.
  remediationDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type EvaluateChecklistItemInput = z.infer<
  typeof evaluateChecklistItemSchema
>;
