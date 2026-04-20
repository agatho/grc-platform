import { z } from "zod";

// ── Sprint 59: Onboarding Wizard und Template Library ──

// Onboarding Session
export const startOnboardingSchema = z.object({
  orgProfile: z
    .object({
      industry: z.string().max(100).optional(),
      employeeCount: z
        .enum(["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+"])
        .optional(),
      country: z.string().length(3).default("DEU"),
      regulatoryScope: z.array(z.string().max(50)).max(20).default([]),
    })
    .default({}),
});

export const updateOnboardingStepSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "skipped"]),
  data: z.record(z.unknown()).default({}),
});

export const selectFrameworksSchema = z.object({
  frameworkKeys: z.array(z.string().max(50)).min(1).max(20),
});

export const selectModulesSchema = z.object({
  moduleKeys: z.array(z.string().max(50)).min(1).max(20),
});

// Template Pack
export const applyTemplatePackSchema = z.object({
  packId: z.string().uuid(),
  options: z
    .object({
      includeControls: z.boolean().default(true),
      includeRisks: z.boolean().default(true),
      includePolicies: z.boolean().default(true),
      includeProcesses: z.boolean().default(false),
      sampleData: z.boolean().default(false),
    })
    .default({}),
});

// Import Wizard
export const createImportJobSchema = z.object({
  source: z.enum(["csv", "excel", "json", "template_pack", "api"]),
  sourceFile: z.string().max(500).optional(),
  templatePackId: z.string().uuid().optional(),
  entityType: z.string().max(50).default("generic"),
  mapping: z.record(z.string(), z.string()).default({}),
});

export const updateImportJobSchema = z.object({
  mapping: z.record(z.string(), z.string()).optional(),
  status: z
    .enum(["pending", "running", "completed", "failed", "cancelled"])
    .optional(),
});

export type StartOnboardingInput = z.infer<typeof startOnboardingSchema>;
export type UpdateOnboardingStepInput = z.infer<
  typeof updateOnboardingStepSchema
>;
export type SelectFrameworksInput = z.infer<typeof selectFrameworksSchema>;
export type SelectModulesInput = z.infer<typeof selectModulesSchema>;
export type ApplyTemplatePackInput = z.infer<typeof applyTemplatePackSchema>;
export type CreateImportJobInput = z.infer<typeof createImportJobSchema>;
export type UpdateImportJobInput = z.infer<typeof updateImportJobSchema>;
