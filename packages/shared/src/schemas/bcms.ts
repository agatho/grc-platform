import { z } from "zod";

// Sprint 6: Business Continuity Management System (BCMS) schemas

// ──────────── BIA ────────────

export const createBiaAssessmentSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  periodStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  periodEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  leadAssessorId: z.string().uuid().optional(),
});

export const submitBiaProcessImpactSchema = z
  .object({
    processId: z.string().uuid(),
    mtpdHours: z.number().int().min(0).optional(),
    rtoHours: z.number().int().min(0).optional(),
    rpoHours: z.number().int().min(0).optional(),
    impact1h: z.number().optional(),
    impact4h: z.number().optional(),
    impact24h: z.number().optional(),
    impact72h: z.number().optional(),
    impact1w: z.number().optional(),
    impact1m: z.number().optional(),
    impactReputation: z.number().int().min(1).max(5).optional(),
    impactLegal: z.number().int().min(1).max(5).optional(),
    impactOperational: z.number().int().min(1).max(5).optional(),
    impactFinancial: z.number().int().min(1).max(5).optional(),
    impactSafety: z.number().int().min(1).max(5).optional(),
    criticalResources: z.string().optional(),
    minimumStaff: z.number().int().min(0).optional(),
    alternateLocation: z.string().max(500).optional(),
    peakPeriods: z.string().optional(),
    isEssential: z.boolean().default(false),
  })
  .refine(
    (d) => !d.rtoHours || !d.mtpdHours || d.rtoHours <= d.mtpdHours,
    { message: "RTO must be <= MTPD" },
  );

export const biaStatusTransitions: Record<string, string[]> = {
  draft: ["in_progress"],
  in_progress: ["review"],
  review: ["approved", "in_progress"],
  approved: ["archived"],
  archived: [],
};

// ──────────── BCP ────────────

export const createBcpSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  scope: z.string().optional(),
  processIds: z.array(z.string().uuid()).default([]),
  bcManagerId: z.string().uuid().optional(),
  activationCriteria: z.string().optional(),
  activationAuthority: z.string().max(255).optional(),
});

export const bcpStatusTransitions: Record<string, string[]> = {
  draft: ["in_review"],
  in_review: ["approved", "draft"],
  approved: ["published"],
  published: ["archived", "superseded"],
  archived: [],
  superseded: [],
};

export const createBcpProcedureSchema = z.object({
  stepNumber: z.number().int().min(1),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  responsibleRole: z.string().max(255).optional(),
  responsibleId: z.string().uuid().optional(),
  estimatedDurationMinutes: z.number().int().min(0).optional(),
  requiredResources: z.string().optional(),
  prerequisites: z.string().optional(),
  successCriteria: z.string().optional(),
});

export const createBcpResourceSchema = z.object({
  resourceType: z.enum([
    "people",
    "it_system",
    "facility",
    "supplier",
    "equipment",
    "data",
    "other",
  ]),
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  assetId: z.string().uuid().optional(),
  isAvailableOffsite: z.boolean().default(false),
  alternativeResource: z.string().max(500).optional(),
  priority: z.enum(["required", "nice_to_have"]).default("required"),
});

// ──────────── Crisis ────────────

export const createCrisisScenarioSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  category: z.enum([
    "cyber_attack",
    "fire",
    "pandemic",
    "supply_chain",
    "natural_disaster",
    "it_outage",
    "other",
  ]),
  severity: z
    .enum([
      "level_1_incident",
      "level_2_emergency",
      "level_3_crisis",
      "level_4_catastrophe",
    ])
    .default("level_2_emergency"),
  bcpId: z.string().uuid().optional(),
  escalationMatrix: z
    .array(
      z.object({
        level: z.number().int().min(1).max(4),
        triggerCriteria: z.string(),
        notifyRoles: z.array(z.string()),
        autoNotify: z.boolean().default(true),
      }),
    )
    .default([]),
  communicationTemplate: z.string().optional(),
});

export const activateCrisisSchema = z.object({
  scenarioId: z.string().uuid(),
  initialAssessment: z.string().optional(),
});

export const addCrisisLogEntrySchema = z.object({
  entryType: z.enum([
    "decision",
    "communication",
    "action",
    "status_change",
    "observation",
  ]),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
});

// ──────────── Continuity Strategy ────────────

export const createContinuityStrategySchema = z.object({
  processId: z.string().uuid(),
  strategyType: z.enum([
    "active_active",
    "active_passive",
    "cold_standby",
    "manual_workaround",
    "outsource",
    "do_nothing",
  ]),
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  rtoTargetHours: z.number().int().min(0),
  estimatedCostEur: z.number().min(0).optional(),
  annualCostEur: z.number().min(0).optional(),
  requiredStaff: z.number().int().min(0).optional(),
  requiredSystems: z.string().optional(),
  alternateLocation: z.string().max(500).optional(),
});

// ──────────── BC Exercise ────────────

export const createBcExerciseSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  exerciseType: z.enum([
    "tabletop",
    "walkthrough",
    "functional",
    "full_simulation",
  ]),
  crisisScenarioId: z.string().uuid().optional(),
  bcpId: z.string().uuid().optional(),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedDurationHours: z.number().int().min(1).optional(),
  exerciseLeadId: z.string().uuid().optional(),
  participantIds: z.array(z.string().uuid()).default([]),
  objectives: z
    .array(
      z.object({
        title: z.string(),
        met: z.boolean().default(false),
        notes: z.string().optional(),
      }),
    )
    .default([]),
});

export const completeExerciseSchema = z.object({
  actualDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  actualDurationHours: z.number().int().min(0),
  overallResult: z.enum(["successful", "partially_successful", "failed"]),
  lessonsLearned: z.string().optional(),
  objectives: z.array(
    z.object({
      title: z.string(),
      met: z.boolean(),
      notes: z.string().optional(),
    }),
  ),
});

export const createExerciseFindingSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  severity: z.enum(["critical", "major", "minor", "observation"]),
  recommendation: z.string().optional(),
});

// ──────────── Update schemas ────────────

export const updateBiaAssessmentSchema = createBiaAssessmentSchema.partial();

export const updateBcpSchema = createBcpSchema.partial();
export const updateBcpProcedureSchema = createBcpProcedureSchema.partial();

export const updateCrisisScenarioSchema = createCrisisScenarioSchema.partial();

export const updateContinuityStrategySchema = createContinuityStrategySchema.partial();

export const updateBcExerciseSchema = createBcExerciseSchema.partial();

// ──────────── Crisis Team Member ────────────

export const addCrisisTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["crisis_lead", "communication", "technical", "logistics", "legal"]),
  isPrimary: z.boolean().default(true),
  deputyUserId: z.string().uuid().optional(),
  phoneNumber: z.string().max(50).optional(),
});

// ──────────── BIA Supplier Dependency ────────────

export const createBiaSupplierDependencySchema = z.object({
  supplierName: z.string().min(1).max(500),
  service: z.string().max(500).optional(),
  isCritical: z.boolean().default(false),
  alternativeAvailable: z.boolean().default(false),
  switchoverTimeHours: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

// ──────────── BCP Status Transition ────────────

export const bcpStatusTransitionSchema = z.object({
  status: z.enum(["draft", "in_review", "approved", "published", "archived", "superseded"]),
});
