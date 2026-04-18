import { z } from "zod";

// Sprint 5a: ISMS — Assets, Protection Requirements & Incidents

export const protectionLevel = z.enum(["normal", "high", "very_high"]);
export const incidentSeverity = z.enum(["low", "medium", "high", "critical"]);
export const incidentStatus = z.enum([
  "detected",
  "triaged",
  "contained",
  "eradicated",
  "recovered",
  "lessons_learned",
  "closed",
]);
export const dependencyType = z.enum(["uses", "produces", "manages", "depends_on"]);
export const ismsObjectCriticality = z.enum(["low", "medium", "high", "critical"]);

// ─── Asset Classification (PRQ) ─────────────────────────────

export const classifyAssetSchema = z.object({
  confidentialityLevel: protectionLevel,
  confidentialityReason: z.string().max(2000).optional(),
  integrityLevel: protectionLevel,
  integrityReason: z.string().max(2000).optional(),
  availabilityLevel: protectionLevel,
  availabilityReason: z.string().max(2000).optional(),
  reviewDate: z.string().date().optional(),
});

// ─── Process-Asset Linkage (EAM) ────────────────────────────

export const createProcessAssetSchema = z.object({
  processId: z.string().uuid(),
  assetId: z.string().uuid(),
  dependencyType: dependencyType.default("uses"),
  criticality: ismsObjectCriticality.default("medium"),
  notes: z.string().max(2000).optional(),
});

// ─── Threats ─────────────────────────────────────────────────

export const createThreatSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  threatCategory: z.string().max(100).optional(),
  likelihoodRating: z.number().int().min(1).max(5).optional(),
  catalogEntryId: z.string().uuid().optional(),
});

// ─── Vulnerabilities ─────────────────────────────────────────

export const createVulnerabilitySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  cveReference: z.string().max(50).optional(),
  affectedAssetId: z.string().uuid().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  mitigationControlId: z.string().uuid().optional(),
});

// ─── Risk Scenarios ──────────────────────────────────────────

export const createRiskScenarioSchema = z.object({
  threatId: z.string().uuid(),
  vulnerabilityId: z.string().uuid().optional(),
  assetId: z.string().uuid(),
  riskId: z.string().uuid().optional(),
  description: z.string().max(5000).optional(),
});

// ─── Security Incidents ──────────────────────────────────────

export const createIncidentSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  severity: incidentSeverity.default("medium"),
  incidentType: z.string().max(100).optional(),
  detectedAt: z.string().datetime().optional(),
  assignedTo: z.string().uuid().optional(),
  affectedAssetIds: z.array(z.string().uuid()).default([]),
  affectedProcessIds: z.array(z.string().uuid()).default([]),
  isDataBreach: z.boolean().default(false),
});

export const updateIncidentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  severity: incidentSeverity.optional(),
  incidentType: z.string().max(100).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  affectedAssetIds: z.array(z.string().uuid()).optional(),
  affectedProcessIds: z.array(z.string().uuid()).optional(),
  isDataBreach: z.boolean().optional(),
  rootCause: z.string().max(10000).optional(),
  remediationActions: z.string().max(10000).optional(),
  lessonsLearned: z.string().max(10000).optional(),
});

// ─── Incident Status Transition ──────────────────────────────

export const incidentStatusTransitions: Record<string, string[]> = {
  detected: ["triaged"],
  triaged: ["contained", "eradicated"],
  contained: ["eradicated"],
  eradicated: ["recovered"],
  recovered: ["lessons_learned"],
  lessons_learned: ["closed"],
  closed: ["detected"], // reopen
};

export function isValidIncidentTransition(from: string, to: string): boolean {
  return incidentStatusTransitions[from]?.includes(to) ?? false;
}

export const incidentStatusTransitionSchema = z.object({
  status: incidentStatus,
});

// ─── Incident Timeline ───────────────────────────────────────

export const createIncidentTimelineEntrySchema = z.object({
  actionType: z.enum([
    "detection",
    "triage",
    "containment",
    "communication",
    "escalation",
    "recovery",
    "eradication",
    "lessons_learned",
    "other",
  ]),
  description: z.string().min(1).max(5000),
  occurredAt: z.string().datetime().optional(),
});

// Sprint 5b: ISMS Assessment schemas

const assessmentStatusValues = ["planning", "in_progress", "review", "completed", "cancelled"] as const;
const assessmentScopeTypeValues = ["full", "department", "asset_group", "custom"] as const;
const evalResultValues = ["effective", "partially_effective", "ineffective", "not_applicable", "not_evaluated"] as const;
const riskDecisionValues = ["accept", "mitigate", "transfer", "avoid", "pending"] as const;
const soaApplicabilityValues = ["applicable", "not_applicable", "partially_applicable"] as const;
const soaImplementationValues = ["implemented", "partially_implemented", "planned", "not_implemented"] as const;
const reviewStatusValues = ["planned", "in_progress", "completed", "cancelled"] as const;

const maturityScale = z.number().int().min(1).max(5);

// ─── Assessment Run ────────────────────────────────────────────

export const createAssessmentRunSchema = z
  .object({
    name: z.string().min(1).max(500),
    description: z.string().max(5000).optional(),
    scopeType: z.enum(assessmentScopeTypeValues).default("full"),
    scopeFilter: z.record(z.unknown()).optional(),
    framework: z.string().max(100).default("iso27001"),
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
    leadAssessorId: z.string().uuid().optional(),
  })
  .refine(
    (data) => data.periodEnd >= data.periodStart,
    { message: "periodEnd must be >= periodStart", path: ["periodEnd"] },
  );

// ─── Setup-Wizard (ADR-014 Phase 3 ISMS Sprint 1.1) ────────────
//
// 3-Step-Wizard-Input: komplettere Struktur als createAssessmentRun.
// Enthaelt: Basics, Scope-Filter-Strukturierung, Team.
// Die Route /setup-wizard validiert, dass Gate G1 nach Speicherung
// erfuellt werden KANN (nicht muss -- der Wizard kann auch partial
// gespeichert werden und später finalisiert).

export const assessmentSetupWizardSchema = z
  .object({
    // Step 1: Basics
    name: z.string().min(1).max(500),
    // Scope-Statement -- min. 200 Zeichen fuer Gate G1 (Finalize),
    // hier nur >=1, damit Wizard zwischen-speicherbar ist.
    description: z.string().min(1).max(5000),
    // Multi-Framework-Support: ein Run kann mehrere Frameworks
    // gleichzeitig abdecken via Cross-Framework-Mappings.
    frameworks: z.array(z.string().max(100)).min(1).max(10),

    // Step 2: Scope
    scopeType: z.enum(assessmentScopeTypeValues).default("full"),
    scopeFilter: z
      .object({
        assetIds: z.array(z.string().uuid()).optional(),
        processIds: z.array(z.string().uuid()).optional(),
        unitIds: z.array(z.string().uuid()).optional(),
        locationIds: z.array(z.string().uuid()).optional(),
        contextFactors: z.string().max(2000).optional(),
      })
      .optional(),

    // Step 3: Team + Timeline
    leadAssessorId: z.string().uuid(),
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
  })
  .refine(
    (data) => data.periodEnd >= data.periodStart,
    { message: "periodEnd must be >= periodStart", path: ["periodEnd"] },
  )
  .refine(
    (data) => {
      const diffMs = new Date(data.periodEnd).getTime() - new Date(data.periodStart).getTime();
      return diffMs >= 14 * 24 * 60 * 60 * 1000;
    },
    { message: "Assessment-Periode muss mindestens 14 Tage umfassen", path: ["periodEnd"] },
  );

export type AssessmentSetupWizardInput = z.infer<typeof assessmentSetupWizardSchema>;

// ─── Control Evaluation ────────────────────────────────────────

export const submitControlEvalSchema = z.object({
  controlId: z.string().uuid(),
  assetId: z.string().uuid().optional(),
  result: z.enum(evalResultValues),
  evidence: z.string().max(10000).optional(),
  notes: z.string().max(5000).optional(),
  evidenceDocumentIds: z.array(z.string().uuid()).default([]),
  currentMaturity: maturityScale.optional(),
  targetMaturity: maturityScale.optional(),
});

// ─── Risk Evaluation ───────────────────────────────────────────

export const submitRiskEvalSchema = z.object({
  riskScenarioId: z.string().uuid(),
  residualLikelihood: z.number().int().min(1).max(5).optional(),
  residualImpact: z.number().int().min(1).max(5).optional(),
  decision: z.enum(riskDecisionValues),
  justification: z.string().max(5000).optional(),
});

// ─── SoA (Statement of Applicability) ──────────────────────────

export const updateSoaEntrySchema = z.object({
  controlId: z.string().uuid().nullable().optional(),
  applicability: z.enum(soaApplicabilityValues).optional(),
  applicabilityJustification: z.string().max(5000).optional(),
  implementation: z.enum(soaImplementationValues).optional(),
  implementationNotes: z.string().max(5000).optional(),
  responsibleId: z.string().uuid().nullable().optional(),
});

export const bulkUpdateSoaSchema = z.object({
  entries: z
    .array(
      z.object({
        catalogEntryId: z.string().uuid(),
        controlId: z.string().uuid().nullable().optional(),
        applicability: z.enum(soaApplicabilityValues).optional(),
        applicabilityJustification: z.string().max(5000).optional(),
        implementation: z.enum(soaImplementationValues).optional(),
        implementationNotes: z.string().max(5000).optional(),
        responsibleId: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1)
    .max(200),
});

// ─── Management Review ─────────────────────────────────────────

export const createManagementReviewSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  reviewDate: z.string().min(1),
  chairId: z.string().uuid().optional(),
  participantIds: z.array(z.string().uuid()).default([]),
  nextReviewDate: z.string().optional(),
});

export const updateManagementReviewSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  reviewDate: z.string().optional(),
  status: z.enum(reviewStatusValues).optional(),
  chairId: z.string().uuid().nullable().optional(),
  participantIds: z.array(z.string().uuid()).optional(),
  changesInContext: z.string().max(10000).optional(),
  performanceFeedback: z.string().max(10000).optional(),
  riskAssessmentResults: z.string().max(10000).optional(),
  auditResults: z.string().max(10000).optional(),
  improvementOpportunities: z.string().max(10000).optional(),
  decisions: z.record(z.unknown()).optional(),
  actionItems: z.record(z.unknown()).optional(),
  minutes: z.string().max(50000).optional(),
  nextReviewDate: z.string().nullable().optional(),
});

// ─── Maturity Rating ───────────────────────────────────────────

export const rateMaturitySchema = z.object({
  controlId: z.string().uuid(),
  assessmentRunId: z.string().uuid().optional(),
  currentMaturity: maturityScale,
  targetMaturity: maturityScale,
  justification: z.string().max(5000).optional(),
});
