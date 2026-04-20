import { z } from "zod";

// Sprint 36: Enterprise Architecture Management (EAM) Zod Schemas

export const createArchitectureElementSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  layer: z.enum(["business", "application", "technology"]),
  type: z.enum([
    "business_capability",
    "business_service",
    "business_function",
    "application",
    "app_service",
    "app_interface",
    "app_component",
    "data_object",
    "server",
    "network",
    "cloud_service",
    "database",
    "infrastructure_service",
  ]),
  assetId: z.string().uuid().optional(),
  processId: z.string().uuid().optional(),
  owner: z.string().uuid().optional(),
  department: z.string().max(200).optional(),
  criticality: z
    .enum(["critical", "important", "normal", "low"])
    .default("normal"),
  tags: z.array(z.string().max(100)).max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateArchitectureElementSchema =
  createArchitectureElementSchema.partial();

export const createArchRelationshipSchema = z
  .object({
    sourceId: z.string().uuid(),
    targetId: z.string().uuid(),
    relationshipType: z.enum([
      "realizes",
      "serves",
      "runs_on",
      "accesses",
      "flows_to",
      "composes",
      "depends_on",
      "deployed_on",
      "uses",
    ]),
    criticality: z
      .enum(["critical", "important", "supportive", "normal"])
      .default("normal"),
    dataFlowDirection: z
      .enum(["inbound", "outbound", "bidirectional"])
      .optional(),
    description: z.string().max(2000).optional(),
  })
  .refine((d) => d.sourceId !== d.targetId, {
    message: "Self-referencing relationships are not allowed",
  });

export const createBusinessCapabilitySchema = z.object({
  elementId: z.string().uuid().optional(),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  parentId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).default(0),
  maturityLevel: z.number().int().min(0).max(5).optional(),
  strategicImportance: z.enum(["core", "supporting", "commodity"]).optional(),
});

export const updateBusinessCapabilitySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  maturityLevel: z.number().int().min(0).max(5).optional(),
  strategicImportance: z.enum(["core", "supporting", "commodity"]).optional(),
});

export const applicationPortfolioSchema = z.object({
  vendorName: z.string().max(500).optional(),
  vendorId: z.string().uuid().optional(),
  version: z.string().max(100).optional(),
  licenseType: z
    .enum(["saas", "on_premise", "hybrid", "open_source"])
    .optional(),
  plannedIntroduction: z.string().date().optional(),
  goLiveDate: z.string().date().optional(),
  plannedEol: z.string().date().optional(),
  lifecycleStatus: z
    .enum(["planned", "active", "phase_out", "end_of_life", "retired"])
    .default("active"),
  timeClassification: z
    .enum(["tolerate", "invest", "migrate", "eliminate"])
    .optional(),
  businessValue: z.number().int().min(1).max(5).optional(),
  technicalCondition: z.number().int().min(1).max(5).optional(),
  annualCost: z.number().min(0).optional(),
  userCount: z.number().int().min(0).optional(),
  costCenter: z.string().max(100).optional(),
  hasApi: z.boolean().optional(),
  authMethod: z.string().max(50).optional(),
  dataClassification: z
    .enum(["public", "internal", "confidential", "restricted"])
    .optional(),
});

export const createArchitectureRuleSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  ruleType: z.enum([
    "lifecycle",
    "dependency",
    "redundancy",
    "classification",
    "custom",
  ]),
  condition: z.record(z.unknown()),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
  isActive: z.boolean().default(true),
});

export const updateViolationStatusSchema = z.object({
  status: z.enum(["open", "acknowledged", "resolved", "false_positive"]),
});

export const archiMateImportSchema = z.object({
  xml: z.string().min(1).max(10000000),
  preview: z.boolean().default(false),
});

export const eamCsvImportSchema = z.object({
  data: z.array(z.record(z.string())).min(1).max(1000),
  mapping: z.record(z.string()),
});

// Layer-type validation helper
export const VALID_LAYER_TYPES: Record<string, string[]> = {
  business: ["business_capability", "business_service", "business_function"],
  application: [
    "application",
    "app_service",
    "app_interface",
    "app_component",
    "data_object",
  ],
  technology: [
    "server",
    "network",
    "cloud_service",
    "database",
    "infrastructure_service",
  ],
};
