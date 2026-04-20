import { z } from "zod";

// Sprint 40: ICS Advanced — CCM, SOX, Deficiency, Control Library, 3LoD

// ─── CCM Connectors ─────────────────────────────────────────
export const createCcmConnectorSchema = z.object({
  name: z.string().min(1).max(300),
  connectorType: z.enum([
    "azure_ad",
    "aws_cloudtrail",
    "jira",
    "servicenow",
    "qualys",
    "nessus",
    "custom_api",
  ]),
  config: z.record(z.unknown()),
  credentialRef: z.string().max(200).optional(),
  targetControlIds: z.array(z.string().uuid()).min(1).max(50),
  schedule: z.enum(["hourly", "daily", "weekly"]).default("daily"),
  evaluationRules: z
    .array(
      z.object({
        field: z.string().min(1),
        operator: z.enum([
          "gte",
          "lte",
          "eq",
          "ne",
          "contains",
          "not_contains",
        ]),
        expectedValue: z.unknown(),
        threshold: z.number().optional(),
      }),
    )
    .min(1)
    .max(20),
});

export const updateCcmConnectorSchema = createCcmConnectorSchema.partial();

// ─── SOX Scope ──────────────────────────────────────────────
export const createSoxScopeSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2099),
  inScopeProcessIds: z.array(z.string().uuid()).optional(),
  inScopeAccounts: z
    .array(
      z.object({
        name: z.string().min(1),
        significance: z.enum(["significant", "material"]),
        balance: z.number().optional(),
      }),
    )
    .optional(),
  inScopeLocationIds: z.array(z.string().uuid()).optional(),
  inScopeItSystemIds: z.array(z.string().uuid()).optional(),
  scopingCriteria: z.record(z.unknown()).optional(),
});

export const updateSoxScopeSchema = createSoxScopeSchema.partial().extend({
  status: z.enum(["draft", "finalized", "approved"]).optional(),
});

// ─── SOX Walkthrough ────────────────────────────────────────
export const createSoxWalkthroughSchema = z.object({
  controlId: z.string().uuid(),
  fiscalYear: z.number().int().min(2020).max(2099),
  narrative: z.string().min(1).max(10000),
  inputs: z.string().max(5000).optional(),
  procedures: z.string().max(10000).optional(),
  outputs: z.string().max(5000).optional(),
  evidenceDescription: z.string().max(5000).optional(),
  controlDesignEffective: z.boolean().optional(),
});

// ─── Control Deficiency ─────────────────────────────────────
export const createDeficiencySchema = z.object({
  controlId: z.string().uuid(),
  findingId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  classification: z.enum([
    "deficiency",
    "significant_deficiency",
    "material_weakness",
  ]),
  rootCauseMethod: z.enum(["five_why", "fishbone", "other"]).optional(),
  rootCause: z.string().max(10000).optional(),
  remediationPlan: z.string().max(10000).optional(),
  remediationResponsible: z.string().uuid().optional(),
  remediationDeadline: z.string().date().optional(),
});

export const updateDeficiencyStatusSchema = z.object({
  remediationStatus: z.enum([
    "open",
    "in_progress",
    "remediated",
    "retesting",
    "closed",
    "accepted",
  ]),
  retestDate: z.string().date().optional(),
  retestResult: z.enum(["pass", "fail"]).optional(),
});

// ─── Control Library ────────────────────────────────────────
export const adoptControlsSchema = z.object({
  libraryEntryIds: z.array(z.string().uuid()).min(1).max(100),
});

// ─── SOX Sample Size ────────────────────────────────────────
export function computeSoxSampleSize(controlFrequency: string): number {
  const SAMPLE_MAP: Record<string, number> = {
    annual: 1,
    quarterly: 2,
    monthly: 3,
    weekly: 5,
    daily: 25,
    continuous: 25,
    multiple_daily: 40,
  };
  return SAMPLE_MAP[controlFrequency] ?? 25;
}

// ─── CCM Evaluation ─────────────────────────────────────────
export interface EvaluationRule {
  field: string;
  operator: "gte" | "lte" | "eq" | "ne" | "contains" | "not_contains";
  expectedValue: unknown;
  threshold?: number;
}

export interface CCMConnectorInterface {
  type: string;
  connect(config: Record<string, unknown>): Promise<void>;
  collectEvidence(controlIds: string[]): Promise<CCMEvidenceResult[]>;
  evaluate(
    evidence: Record<string, unknown>,
    rules: EvaluationRule[],
  ): EvaluationResult;
}

export interface CCMEvidenceResult {
  controlId: string;
  rawData: Record<string, unknown>;
  evaluationResult: "pass" | "fail" | "degraded" | "error";
  evaluationDetail: string;
  score: number;
}

export interface EvaluationResult {
  result: "pass" | "fail" | "degraded" | "error";
  detail: string;
  score: number;
  ruleResults: Array<{ field: string; passed: boolean; actual: unknown }>;
}

// ─── Deficiency State Machine ───────────────────────────────
export const DEFICIENCY_TRANSITIONS: Record<string, string[]> = {
  open: ["in_progress"],
  in_progress: ["remediated", "accepted"],
  remediated: ["retesting"],
  retesting: ["closed", "in_progress"],
  accepted: [],
  closed: [],
};

export function isValidDeficiencyTransition(
  currentStatus: string,
  newStatus: string,
): boolean {
  return DEFICIENCY_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}
