import { z } from "zod";
// [ARCTOS-FULL-2026-08-31 · OP-001] Die Buchstabenliste steht schon in
// `bpm-derived.ts`; eine zweite Liste hier waere genau die Doppelquelle, die
// STUFE2-E §1.2 fuer `severity` als Fehlerklasse beschreibt.
import { raciRoleValues } from "./bpm-derived";

// Sprint 3: BPMN Process Modeling schemas

const processNotationValues = ["bpmn", "value_chain", "epc"] as const;
const processStatusValues = [
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
] as const;
const stepTypeValues = [
  "task",
  "gateway",
  "event",
  "subprocess",
  "call_activity",
] as const;
// Prozesslandkarte: value-chain band (management / core / support)
const processMapCategoryValues = ["management", "core", "support"] as const;

// ─── Process CRUD ────────────────────────────────────────────

export const createProcessSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(500),
  description: z.string().max(5000).optional().nullable(),
  level: z.number().int().min(1).max(10).default(1),
  parentProcessId: z.string().uuid().optional().nullable(),
  processOwnerId: z.string().uuid().optional().nullable(),
  reviewerId: z.string().uuid().optional().nullable(),
  department: z.string().max(255).optional().nullable(),
  notation: z.enum(processNotationValues).default("bpmn"),
  isEssential: z.boolean().default(false),
  reviewDate: z.string().datetime().optional().nullable(),
  reviewCycleDays: z.number().int().min(1).max(730).optional().nullable(),
});

export const updateProcessSchema = z.object({
  name: z.string().min(3).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  level: z.number().int().min(1).max(10).optional(),
  parentProcessId: z.string().uuid().optional().nullable(),
  processOwnerId: z.string().uuid().optional().nullable(),
  reviewerId: z.string().uuid().optional().nullable(),
  department: z.string().max(255).optional().nullable(),
  isEssential: z.boolean().optional(),
  reviewDate: z.string().datetime().nullable().optional(),
  reviewCycleDays: z.number().int().min(1).max(730).nullable().optional(),
  // BPM Overhaul Phase 4 C2
  complianceProfile: z
    .enum([
      "standard",
      "gdpr_ropa",
      "iso_22301_bia",
      "nis2_critical",
      "iso_9001_quality",
      "dora_critical_ict",
    ])
    .optional(),
  isCriticalProcess: z.boolean().optional(),
  criticalityRationale: z.string().max(2000).nullable().optional(),
  defaultLineOfDefense: z
    .enum(["first", "second", "third", "oversight"])
    .nullable()
    .optional(),
  // Prozesslandkarte: null = keine Kategorie (erbt Band des Parents)
  mapCategory: z.enum(processMapCategoryValues).nullable().optional(),
  // Prozesslandkarte: manuelle Reihenfolge im Band (null = unsortiert,
  // landet hinter den sortierten). Bulk-Umsortierung läuft über
  // PUT /processes/map/reorder mit reorderProcessMapSchema.
  mapSequence: z.number().int().min(0).max(1_000_000).nullable().optional(),
});

// ─── Prozesslandkarte: Reorder (PUT /processes/map/reorder) ──

export const reorderProcessMapSchema = z.object({
  // "unassigned" is a real band on the map (uncategorized root
  // processes) and stays sortable like the three value-chain bands.
  category: z.enum([...processMapCategoryValues, "unassigned"]),
  orderedIds: z
    .array(z.string().uuid())
    .min(1)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "orderedIds must not contain duplicates",
    }),
});

// ─── Process Version ─────────────────────────────────────────

export const createVersionSchema = z.object({
  bpmnXml: z.string().min(50, "BPMN XML too short to be valid"),
  changeSummary: z.string().max(500).optional(),
});

// ─── Process Status Transition ───────────────────────────────

export const transitionProcessStatusSchema = z.object({
  status: z.enum(processStatusValues),
  comment: z.string().max(1000).optional(),
});

// ─── Approval Chain (B2 Release-Cycle) ───────────────────────

export const approvalStepTypeValues = [
  "review",
  "approval",
  "acknowledgment",
] as const;

const approvalStepInputSchema = z
  .object({
    stepType: z.enum(approvalStepTypeValues),
    assigneeUserId: z.string().uuid().optional().nullable(),
    assigneeRole: z.string().max(80).optional().nullable(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
      .optional()
      .nullable(),
  })
  .refine((s) => Boolean(s.assigneeUserId || s.assigneeRole), {
    message: "Either assigneeUserId or assigneeRole is required",
    path: ["assigneeUserId"],
  });

export const createApprovalStepsSchema = z.object({
  versionNumber: z.number().int().min(1).optional(),
  // Explicit chain; when omitted the default chain is generated
  // (1 reviewer → 1 approver → acknowledgment list).
  steps: z.array(approvalStepInputSchema).min(1).max(100).optional(),
  // Users that must acknowledge the published version (default chain).
  acknowledgmentUserIds: z.array(z.string().uuid()).max(100).optional(),
});

export const decideApprovalStepSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    comment: z.string().max(2000).optional(),
  })
  .refine(
    (d) =>
      d.decision !== "reject" ||
      (typeof d.comment === "string" && d.comment.trim().length > 0),
    {
      message: "A comment is required when rejecting",
      path: ["comment"],
    },
  );

export const acknowledgeProcessSchema = z.object({
  comment: z.string().max(1000).optional(),
});

// ─── Risk Linkage ────────────────────────────────────────────

export const linkProcessRiskSchema = z.object({
  riskId: z.string().uuid(),
  riskContext: z.string().max(1000).optional(),
});

// ─── AI BPMN Generation ──────────────────────────────────────

export const generateBpmnSchema = z.object({
  name: z.string().min(3).max(200),
  description: z
    .string()
    .min(50, "Description must be at least 50 characters for good results")
    .max(2000),
  industry: z
    .enum([
      "manufacturing",
      "it_services",
      "financial_services",
      "healthcare",
      "generic",
    ])
    .default("generic"),
});

// ─── Process Step Update ─────────────────────────────────────

export const updateProcessStepSchema = z.object({
  responsibleRole: z.string().max(255).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  // Call-Activity Drill-Down: linked child process (null = unlink)
  calledProcessId: z.string().uuid().optional().nullable(),
});

// ─── Asset Linkage (Gap 1) ────────────────────────────────────

export const linkProcessAssetSchema = z.object({
  assetId: z.string().uuid(),
});

// ─── Control Linkage (Gap 3) ──────────────────────────────────

export const linkProcessControlSchema = z.object({
  controlId: z.string().uuid(),
  controlContext: z.string().max(1000).optional(),
});

// ─── Document Linkage (Gap 4) ─────────────────────────────────

export const linkProcessDocumentSchema = z.object({
  documentId: z.string().uuid(),
  documentType: z
    .enum(["policy", "procedure", "guideline", "sop", "form"])
    .optional(),
  linkContext: z.string().max(1000).optional(),
});

// Sprint 3b: Process Governance schemas

// ─── Comment CRUD ─────────────────────────────────────────────

export const createCommentSchema = z.object({
  processId: z.string().uuid(),
  entityType: z.enum(["process", "process_step"]).default("process"),
  entityId: z.string().uuid(),
  content: z.string().min(1, "Comment cannot be empty").max(5000),
  parentCommentId: z.string().uuid().optional(),
  mentionedUserIds: z.array(z.string().uuid()).optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(5000),
  isResolved: z.boolean().optional(),
});

export const commentListQuerySchema = z.object({
  processId: z.string().uuid(),
  entityType: z.enum(["process", "process_step"]).optional(),
  entityId: z.string().uuid().optional(),
  isResolved: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  page: z.string().transform(Number).pipe(z.number().int().min(1)).default("1"),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default("50"),
});

// ─── Review Schedule ──────────────────────────────────────────

export const createReviewScheduleSchema = z.object({
  processId: z.string().uuid(),
  reviewIntervalMonths: z.number().int().min(1).max(60),
  nextReviewDate: z.string().min(1, "Next review date is required"),
  assignedReviewerId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

// ─── Bulk Operations ──────────────────────────────────────────

export const bulkActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("change_status"),
    processIds: z.array(z.string().uuid()).min(1).max(100),
    status: z.enum(processStatusValues),
    comment: z.string().max(1000).optional(),
  }),
  z.object({
    action: z.literal("assign_owner"),
    processIds: z.array(z.string().uuid()).min(1).max(100),
    processOwnerId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("assign_reviewer"),
    processIds: z.array(z.string().uuid()).min(1).max(100),
    reviewerId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("change_department"),
    processIds: z.array(z.string().uuid()).min(1).max(100),
    department: z.string().max(255),
  }),
  z.object({
    action: z.literal("delete"),
    processIds: z.array(z.string().uuid()).min(1).max(100),
  }),
]);

// ─── Version Compare ─────────────────────────────────────────

export const versionCompareQuerySchema = z.object({
  processId: z.string().uuid(),
  versionA: z.string().transform(Number).pipe(z.number().int().min(1)),
  versionB: z.string().transform(Number).pipe(z.number().int().min(1)),
});

// ─── BPMN Validation Config ──────────────────────────────────

const validationRuleLevelValues = ["error", "warning", "disabled"] as const;

export const bpmnValidationConfigSchema = z.object({
  missingStartEvent: z.enum(validationRuleLevelValues).default("error"),
  missingEndEvent: z.enum(validationRuleLevelValues).default("error"),
  disconnectedElements: z.enum(validationRuleLevelValues).default("error"),
  gatewayMissingDefault: z.enum(validationRuleLevelValues).default("warning"),
});

// ─── GRC-Diagrammdaten: Pflegeoberfläche ─────────────────────
//
// [ARCTOS-FULL-2026-08-31 · OP-001] Die zehn Tabellen aus
// `docs/bpmn-engine/STUFE2-E-SCHEMA.md` §6.4 waren bis hierher **nur per SQL**
// pflegbar — gemessen: 0 Zeilen in allen zehn, auch in der geseedeten
// Datenbank. Diese Schemata sind der Vertrag der ersten vier Masken. Die
// Wertelisten sind wörtlich die CHECK-Bedingungen der Migrationen 0444, 0446,
// 0447 und 0449; eine zweite, abweichende Liste in der Anwendung wäre genau
// die Fehlerklasse, die STUFE2-E §1.2 für `severity` beschreibt.

export const laneCarrierKinds = ["lane", "pool"] as const;

/**
 * Der Träger einer Lane. Name, Art und Reihenfolge stehen bewusst NICHT hier:
 * die kommen aus dem BPMN-XML und werden vom Import gepflegt (OP-002). Was
 * eine Maske setzt, ist genau das, was im XML nicht steht.
 */
export const updateProcessLaneSchema = z
  .object({
    orgUnitId: z.string().uuid().nullable().optional(),
    customRoleId: z.string().uuid().nullable().optional(),
    vendorId: z.string().uuid().nullable().optional(),
    isExternal: z.boolean().optional(),
    // ISO 3166-1 alpha-2, Grossbuchstaben — `char(2)` in 0444.
    thirdCountry: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable()
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  })
  .refine((v) => !(v.thirdCountry != null && v.isExternal === false), {
    // Ein Drittland an einer Lane, die ausdrücklich als intern markiert wird,
    // ist ein Widerspruch — und F5 zöge daraus eine Vertrauensgrenze, die die
    // Maske gerade verneint hat.
    message: "thirdCountry requires isExternal",
    path: ["thirdCountry"],
  });

export const sodSeverityValues = ["low", "medium", "high", "critical"] as const;

export const createSodRuleSchema = z.object({
  roleAId: z.string().uuid(),
  // Die Selbstpaarung ist ausdrücklich zulässig: „dieselbe Rolle verantwortet
  // beide Aufgaben" ist der Verstoss, den ein IKS-Prüfer sucht
  // (STUFE2-A2-GRC.md §7.3). Kein `refine` gegen roleAId === roleBId.
  roleBId: z.string().uuid(),
  severity: z.enum(sodSeverityValues).default("high"),
  rationale: z.string().max(4000).optional(),
  frameworkRef: z.string().max(80).optional(),
  isActive: z.boolean().default(true),
});

export const updateSodRuleSchema = z
  .object({
    severity: z.enum(sodSeverityValues).optional(),
    rationale: z.string().max(4000).nullable().optional(),
    frameworkRef: z.string().max(80).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * Die RACI-Zuordnungen **eines** Schritts, vollständig ersetzend.
 *
 * Ersetzend statt additiv, weil das Entfernen einer Zuordnung sonst keine
 * Bedienoperation hätte: „Rolle X ist hier nicht mehr zu konsultieren" ist
 * eine Aussage, die eine Maske treffen können muss.
 */
export const putStepRaciSchema = z.object({
  entries: z
    .array(
      z.object({
        roleId: z.string().uuid(),
        raciRole: z.enum(raciRoleValues),
        note: z.string().max(1000).nullable().optional(),
      }),
    )
    .max(200),
});

export const biaCriticalityValues = [
  "very_high",
  "high",
  "medium",
  "low",
] as const;

/**
 * Kontinuitätskennzahlen eines Schritts.
 *
 * Minuten, nicht Stunden (STUFE2-E §1.5): ein RPO von 15 Minuten ist in
 * Stunden nicht darstellbar, und §3.10 rechnet den Reisspunkt als Minimum
 * über die Schritte. `workaroundMaxDurationMinutes` lässt 0 ausdrücklich zu —
 * 0 heisst „die Übergangslösung trägt nicht" (§7.4) und ist eine Aussage,
 * kein fehlender Wert.
 */
export const putStepBiaSchema = z.object({
  criticality: z.enum(biaCriticalityValues),
  mtpdMinutes: z.number().int().min(0).nullable().optional(),
  rtoMinutes: z.number().int().min(0).nullable().optional(),
  rpoMinutes: z.number().int().min(0).nullable().optional(),
  workaround: z.string().max(4000).nullable().optional(),
  workaroundMaxDurationMinutes: z.number().int().min(0).nullable().optional(),
  biaAssessmentId: z.string().uuid().nullable().optional(),
});
