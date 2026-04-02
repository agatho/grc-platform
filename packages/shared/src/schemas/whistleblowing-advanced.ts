import { z } from "zod";

// Sprint 46: Whistleblowing Advanced — Zod Schemas

// ─── Investigation Phase State Machine ──────────────────────
export const INVESTIGATION_TRANSITIONS: Record<string, string[]> = {
  intake: ["triage"],
  triage: ["investigation", "closed"],
  investigation: ["decision"],
  decision: ["resolution", "closed"],
  resolution: ["closed"],
  closed: [],
};

export function isValidInvestigationTransition(current: string, next: string): boolean {
  return INVESTIGATION_TRANSITIONS[current]?.includes(next) ?? false;
}

// ─── Investigation ──────────────────────────────────────────
export const createInvestigationSchema = z.object({
  caseId: z.string().uuid(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});

export const advanceInvestigationPhaseSchema = z.object({
  newPhase: z.enum(["triage", "investigation", "decision", "resolution", "closed"]),
  justification: z.string().max(5000).optional(),
});

export const assignInvestigatorSchema = z.object({
  investigatorId: z.string().uuid(),
  overrideConflict: z.boolean().default(false),
  conflictJustification: z.string().max(2000).optional(),
});

export const recordDecisionSchema = z.object({
  decisionOutcome: z.enum(["substantiated", "unsubstantiated", "inconclusive", "partially_substantiated"]),
  recommendedActions: z.string().max(10000).optional(),
});

// ─── Evidence ───────────────────────────────────────────────
export const createWbEvidenceSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  fileUrl: z.string().max(2000).optional(),
  fileType: z.string().max(50).optional(),
  fileSizeBytes: z.number().int().min(0).optional(),
  sourceType: z.enum(["reporter_upload", "investigator_upload", "system_generated", "interview_recording"]),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// ─── Interview ──────────────────────────────────────────────
export const createInterviewSchema = z.object({
  intervieweeReference: z.string().max(200).optional(),
  interviewDate: z.string().date(),
  questionsAsked: z.string().max(20000).optional(),
  responses: z.string().max(20000).optional(),
  observations: z.string().max(10000).optional(),
  consentDocumented: z.boolean().default(false),
  recordingReference: z.string().max(500).optional(),
});

// ─── Protection Case ────────────────────────────────────────
export const createProtectionCaseSchema = z.object({
  caseId: z.string().uuid(),
  reporterReference: z.string().max(200).optional(),
  reporterUserId: z.string().uuid().optional(),
  protectionStartDate: z.string().date(),
  monitoringFrequency: z.enum(["monthly", "quarterly"]).default("monthly"),
});

export const updateProtectionCaseSchema = z.object({
  protectionStatus: z.enum(["active", "monitoring", "concluded"]).optional(),
  monitoringFrequency: z.enum(["monthly", "quarterly"]).optional(),
  conclusionReason: z.string().max(5000).optional(),
});

// ─── Protection Event ───────────────────────────────────────
export const createProtectionEventSchema = z.object({
  eventType: z.enum(["role_change", "salary_change", "performance_review", "disciplinary", "assignment_change", "location_change", "termination"]),
  eventDate: z.string().date(),
  description: z.string().max(5000).optional(),
  flag: z.enum(["normal", "suspicious", "critical"]).default("normal"),
});

export const reviewProtectionEventSchema = z.object({
  flag: z.enum(["normal", "suspicious", "critical"]),
  reviewNotes: z.string().max(5000).optional(),
});

// ─── Default Retaliation Indicator Rules ────────────────────
export const DEFAULT_RETALIATION_RULES = [
  { eventType: "performance_review", timeWindowMonths: 6, severity: "suspicious", description: "Negative performance review within 6 months of report" },
  { eventType: "termination", timeWindowMonths: 0, severity: "critical", description: "Termination at any time after report" },
  { eventType: "role_change", timeWindowMonths: 3, severity: "suspicious", description: "Role change within 3 months of report" },
  { eventType: "salary_change", timeWindowMonths: 6, severity: "suspicious", description: "Salary reduction within 6 months of report" },
  { eventType: "assignment_change", timeWindowMonths: 3, severity: "suspicious", description: "Assignment change within 3 months of report" },
] as const;

// ─── Multi-Channel Intake ───────────────────────────────────
export const createTelephoneIntakeSchema = z.object({
  callerDescription: z.string().max(2000).optional(),
  callDateTime: z.string().datetime(),
  duration: z.number().int().min(0).optional(),
  reportSummary: z.string().min(1).max(20000),
  followUpMethod: z.string().max(200).optional(),
  isAnonymous: z.boolean().default(true),
  category: z.string().max(50).optional(),
});

export const createPostalIntakeSchema = z.object({
  receiptDate: z.string().date(),
  senderInfo: z.string().max(1000).optional(),
  reportTranscription: z.string().min(1).max(20000),
  scanDocumentId: z.string().uuid().optional(),
  isAnonymous: z.boolean().default(true),
  category: z.string().max(50).optional(),
});

export const createWalkInIntakeSchema = z.object({
  visitDate: z.string().date(),
  location: z.string().max(200).optional(),
  attendees: z.string().max(1000).optional(),
  reportSummary: z.string().min(1).max(20000),
  anonymityPreference: z.boolean().default(true),
  followUpAgreement: z.string().max(2000).optional(),
  category: z.string().max(50).optional(),
});

// ─── Routing Rules ──────────────────────────────────────────
export const updateRoutingRulesSchema = z.object({
  rules: z.array(z.object({
    category: z.string().min(1).max(50),
    defaultInvestigatorId: z.string().uuid().optional(),
    departmentExclusions: z.array(z.string().uuid()).max(20).optional(),
    escalationConditions: z.array(z.string().max(200)).max(10).optional(),
  })).max(20),
});

// ─── Ombudsperson ───────────────────────────────────────────
export const createOmbudspersonAssignmentSchema = z.object({
  ombudspersonUserId: z.string().uuid(),
  caseId: z.string().uuid(),
  scope: z.enum(["full_investigation", "consultation"]),
  expiresAt: z.string().datetime(),
});
