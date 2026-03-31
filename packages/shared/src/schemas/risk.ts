import { z } from "zod";

// Sprint 2: Enterprise Risk Management schemas

const riskCategoryValues = [
  "strategic",
  "operational",
  "financial",
  "compliance",
  "cyber",
  "reputational",
  "esg",
] as const;

const riskSourceValues = [
  "isms",
  "erm",
  "bcm",
  "project",
  "process",
] as const;

const riskStatusValues = [
  "identified",
  "assessed",
  "treated",
  "accepted",
  "closed",
] as const;

const treatmentStrategyValues = [
  "mitigate",
  "accept",
  "transfer",
  "avoid",
] as const;

const treatmentStatusValues = [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
] as const;

const kriDirectionValues = ["asc", "desc"] as const;
const kriMeasurementFrequencyValues = ["daily", "weekly", "monthly", "quarterly"] as const;

// ─── Risk CRUD ───────────────────────────────────────────────

export const createRiskSchema = z
  .object({
    title: z.string().min(1).max(500),
    description: z.string().optional(),
    riskCategory: z.enum(riskCategoryValues),
    riskSource: z.enum(riskSourceValues),
    ownerId: z.string().uuid().optional(),
    department: z.string().max(255).optional(),
    reviewDate: z.string().optional(),
    financialImpactMin: z.number().nonnegative().optional(),
    financialImpactMax: z.number().nonnegative().optional(),
    financialImpactExpected: z.number().nonnegative().optional(),
    // Catalog & Framework Layer hook (ADR-013)
    catalogEntryId: z.string().uuid().optional(),
    catalogSource: z.string().max(50).optional(),
  })
  .refine(
    (data) => {
      if (data.financialImpactMin != null && data.financialImpactMax != null) {
        return data.financialImpactMax >= data.financialImpactMin;
      }
      return true;
    },
    { message: "financialImpactMax must be >= financialImpactMin", path: ["financialImpactMax"] },
  );

export const updateRiskSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().optional(),
    riskCategory: z.enum(riskCategoryValues).optional(),
    riskSource: z.enum(riskSourceValues).optional(),
    ownerId: z.string().uuid().nullable().optional(),
    department: z.string().max(255).optional(),
    reviewDate: z.string().nullable().optional(),
    financialImpactMin: z.number().nonnegative().nullable().optional(),
    financialImpactMax: z.number().nonnegative().nullable().optional(),
    financialImpactExpected: z.number().nonnegative().nullable().optional(),
    treatmentStrategy: z.enum(treatmentStrategyValues).nullable().optional(),
    treatmentRationale: z.string().nullable().optional(),
    // Catalog & Framework Layer hook (ADR-013)
    catalogEntryId: z.string().uuid().nullable().optional(),
    catalogSource: z.string().max(50).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.financialImpactMin != null && data.financialImpactMax != null) {
        return data.financialImpactMax >= data.financialImpactMin;
      }
      return true;
    },
    { message: "financialImpactMax must be >= financialImpactMin", path: ["financialImpactMax"] },
  );

// ─── Risk Assessment ─────────────────────────────────────────

const likelihoodImpactScale = z.number().int().min(1).max(5);

export const assessRiskSchema = z
  .object({
    inherentLikelihood: likelihoodImpactScale,
    inherentImpact: likelihoodImpactScale,
    residualLikelihood: likelihoodImpactScale.optional(),
    residualImpact: likelihoodImpactScale.optional(),
  })
  .refine(
    (data) => {
      const hasResL = data.residualLikelihood != null;
      const hasResI = data.residualImpact != null;
      return hasResL === hasResI;
    },
    {
      message: "residualLikelihood and residualImpact must both be provided or both omitted",
      path: ["residualLikelihood"],
    },
  );

// ─── Risk Status Transition ─────────────────────────────────

export const riskStatusTransitionSchema = z.object({
  status: z.enum(riskStatusValues),
});

// ─── Risk Treatment ──────────────────────────────────────────

export const createRiskTreatmentSchema = z.object({
  description: z.string().min(1),
  responsibleId: z.string().uuid().optional(),
  expectedRiskReduction: z.number().min(0).max(100).optional(),
  costEstimate: z.number().nonnegative().optional(),
  status: z.enum(treatmentStatusValues).default("planned"),
  dueDate: z.string().optional(),
  // Cost tracking
  costAnnual: z.number().nonnegative().optional(),
  effortHours: z.number().nonnegative().optional(),
  budgetId: z.string().uuid().optional(),
  costNote: z.string().optional(),
});

export const updateRiskTreatmentSchema = createRiskTreatmentSchema.partial();

// ─── KRI ─────────────────────────────────────────────────────

export const createKriSchema = z
  .object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    riskId: z.string().uuid().optional(),
    unit: z.string().max(50).optional(),
    direction: z.enum(kriDirectionValues),
    thresholdGreen: z.number().optional(),
    thresholdYellow: z.number().optional(),
    thresholdRed: z.number().optional(),
    measurementFrequency: z.enum(kriMeasurementFrequencyValues).default("monthly"),
    alertEnabled: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (
        data.thresholdGreen != null &&
        data.thresholdYellow != null &&
        data.thresholdRed != null
      ) {
        if (data.direction === "asc") {
          // Higher is worse: green < yellow < red
          return data.thresholdGreen <= data.thresholdYellow && data.thresholdYellow <= data.thresholdRed;
        }
        // Lower is worse (desc): green > yellow > red
        return data.thresholdGreen >= data.thresholdYellow && data.thresholdYellow >= data.thresholdRed;
      }
      return true;
    },
    {
      message: "Thresholds must be ordered according to direction (asc: green <= yellow <= red, desc: green >= yellow >= red)",
      path: ["thresholdYellow"],
    },
  );

export const updateKriSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  riskId: z.string().uuid().nullable().optional(),
  unit: z.string().max(50).optional(),
  direction: z.enum(kriDirectionValues).optional(),
  thresholdGreen: z.number().nullable().optional(),
  thresholdYellow: z.number().nullable().optional(),
  thresholdRed: z.number().nullable().optional(),
  measurementFrequency: z.enum(kriMeasurementFrequencyValues).optional(),
  alertEnabled: z.boolean().optional(),
});

// ─── KRI Measurement ─────────────────────────────────────────

export const addKriMeasurementSchema = z.object({
  value: z.number(),
  measuredAt: z.string().datetime(),
  source: z.enum(["manual", "api_import", "calculated"]).default("manual"),
  notes: z.string().optional(),
});
