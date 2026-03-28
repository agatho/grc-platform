import { z } from "zod";

// Sprint 48: EAM Dashboards & Extended Assessment Zod Schemas

export const functionalFitEnum = z.enum(["perfect", "appropriate", "insufficient"]);
export const technicalFitEnum = z.enum(["perfect", "appropriate", "insufficient"]);
export const sixRStrategyEnum = z.enum(["retain", "replatform", "refactor", "rearchitect", "rebuild", "replace"]);
export const businessCriticalityEnum = z.enum(["mission_critical", "business_critical", "business_operational", "administrative_service"]);
export const functionalCoverageEnum = z.enum(["full", "partial", "none"]);
export const strategicAlignmentEnum = z.enum(["aligned", "partially", "misaligned"]);
export const capabilityLifecycleStatusEnum = z.enum(["active", "transforming", "retiring", "planned"]);

export const updateAssessmentSchema = z.object({
  functionalFit: functionalFitEnum.optional(),
  technicalFit: technicalFitEnum.optional(),
  sixRStrategy: sixRStrategyEnum.optional(),
  businessCriticality: businessCriticalityEnum.optional(),
  timeClassification: z.enum(["tolerate", "invest", "migrate", "eliminate"]).optional(),
  businessValue: z.number().int().min(1).max(5).optional(),
  technicalCondition: z.number().int().min(1).max(5).optional(),
  justification: z.string().max(2000).optional(),
});

export const bulkAssessmentSchema = z.object({
  applicationIds: z.array(z.string().uuid()).min(1).max(100),
  assessment: updateAssessmentSchema,
});

export const updateCapabilityAssessmentSchema = z.object({
  functionalCoverage: functionalCoverageEnum.optional(),
  strategicAlignment: strategicAlignmentEnum.optional(),
  lifecycleStatus: capabilityLifecycleStatusEnum.optional(),
});
