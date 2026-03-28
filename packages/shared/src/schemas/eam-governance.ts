import { z } from "zod";

// Sprint 53: EAM Governance & Deep Integration Zod Schemas

export const governanceActionEnum = z.enum(["publish", "approve", "reject", "archive", "change_to_suggestion"]);
export const bpmnPlacementTypeEnum = z.enum(["application", "it_component", "data_object"]);

export const governanceTransitionSchema = z.object({
  action: governanceActionEnum,
  justification: z.string().max(2000).optional(),
});

export const bulkGovernanceSchema = z.object({
  elementIds: z.array(z.string().uuid()).min(1).max(100),
  action: governanceActionEnum,
  justification: z.string().max(2000).optional(),
});

export const governanceRoleAssignmentSchema = z.object({
  examinerId: z.string().uuid().optional(),
  responsibleId: z.string().uuid().optional(),
});

export const createBpmnPlacementSchema = z.object({
  processVersionId: z.string().uuid(),
  eamElementId: z.string().uuid(),
  placementType: bpmnPlacementTypeEnum,
  bpmnNodeId: z.string().max(100).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

export const biExportQuerySchema = z.object({
  $filter: z.string().max(1000).optional(),
  $select: z.string().max(500).optional(),
  $top: z.number().int().min(1).max(1000).default(100),
  $skip: z.number().int().min(0).default(0),
  $orderby: z.string().max(200).optional(),
});

export const biApiKeySchema = z.object({
  name: z.string().min(1).max(200),
  expiresAt: z.string().datetime().optional(),
  rateLimit: z.number().int().min(100).max(10000).default(1000),
});

export const excelImportSchema = z.object({
  objectType: z.enum(["application", "business_capability", "it_component", "data_object"]),
  matchBy: z.enum(["name", "id"]).default("name"),
  dryRun: z.boolean().default(true),
});

export const updatePersonalDataSchema = z.object({
  processesPersonalData: z.boolean(),
  personalDataDetail: z.string().max(2000).optional(),
});

export const predecessorSchema = z.object({
  predecessorId: z.string().uuid().nullable(),
});
