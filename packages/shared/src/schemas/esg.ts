import { z } from "zod";

// Sprint 10: ESG/CSRD Module schemas

const materialityStatusValues = ["draft", "in_progress", "completed"] as const;
const dataQualityValues = ["measured", "estimated", "calculated"] as const;
const targetTypeValues = ["absolute", "intensity", "relative"] as const;
const targetStatusValues = ["on_track", "at_risk", "off_track", "achieved"] as const;
const reportStatusValues = ["draft", "in_review", "approved", "published"] as const;
const esgFrequencyValues = ["annual", "semi_annual", "quarterly"] as const;
const voterTypeValues = ["internal", "customer", "supplier", "investor", "ngo", "regulator"] as const;

export const createMaterialityAssessmentSchema = z.object({
  reportingYear: z.number().int().min(2024).max(2030),
});

export const submitVoteSchema = z.object({
  topicId: z.string().uuid(),
  impactScore: z.number().min(0).max(10),
  financialScore: z.number().min(0).max(10),
  voterType: z.enum(voterTypeValues),
  voterName: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});

export const createEsrsMetricSchema = z.object({
  datapointId: z.string().uuid(),
  name: z.string().min(1).max(500),
  unit: z.string().min(1).max(50),
  frequency: z.enum(esgFrequencyValues).default("annual"),
  collectionMethod: z.enum(["manual", "import", "calculated"]).default("manual"),
  calculationFormula: z.string().max(2000).optional(),
  responsibleUserId: z.string().uuid().optional(),
});

export const recordMeasurementSchema = z.object({
  metricId: z.string().uuid(),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  value: z.number(),
  unit: z.string().max(50),
  dataQuality: z.enum(dataQualityValues),
  source: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const bulkMeasurementImportSchema = z.object({
  measurements: z.array(recordMeasurementSchema).min(1).max(500),
});

export const createTargetSchema = z.object({
  metricId: z.string().uuid(),
  name: z.string().min(1).max(500),
  baselineYear: z.number().int(),
  baselineValue: z.number(),
  targetYear: z.number().int(),
  targetValue: z.number(),
  targetType: z.enum(targetTypeValues).default("absolute"),
  sbtiAligned: z.boolean().default(false),
});

export const verifyMeasurementSchema = z.object({
  verified: z.boolean(),
  notes: z.string().max(2000).optional(),
});
