import { z } from "zod";

// Sprint 50: EAM Data Architecture & Scenario Planning Zod Schemas

export const dataCategoryEnum = z.enum([
  "master_data",
  "transaction_data",
  "reference_data",
  "analytical_data",
]);
export const dataClassificationEnum = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
]);
export const contextTypeEnum = z.enum([
  "as_is",
  "to_be",
  "scenario",
  "historical",
]);
export const contextStatusEnum = z.enum(["draft", "active", "archived"]);

export const createDataObjectSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  parentId: z.string().uuid().optional(),
  dataCategory: dataCategoryEnum,
  classification: dataClassificationEnum.default("internal"),
  ownerApplicationId: z.string().uuid().optional(),
  dataFormat: z.string().max(50).optional(),
  volumeEstimate: z.string().max(100).optional(),
  qualityScore: z.number().int().min(0).max(100).optional(),
  retentionPeriod: z.string().max(50).optional(),
});

export const updateDataObjectSchema = createDataObjectSchema.partial();

export const createCrudMappingSchema = z.object({
  dataObjectId: z.string().uuid(),
  applicationId: z.string().uuid(),
  canCreate: z.boolean().default(false),
  canRead: z.boolean().default(false),
  canUpdate: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
});

export const updateCrudMappingSchema = z.object({
  canCreate: z.boolean().optional(),
  canRead: z.boolean().optional(),
  canUpdate: z.boolean().optional(),
  canDelete: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

export const createContextSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  contextType: contextTypeEnum,
  validFrom: z.string().date().optional(),
  validTo: z.string().date().optional(),
  isDefault: z.boolean().default(false),
  predecessorContextId: z.string().uuid().optional(),
});

export const updateContextSchema = createContextSchema.partial();

export const setContextAttributeSchema = z.object({
  functionalFit: z.string().max(20).nullable().optional(),
  technicalFit: z.string().max(20).nullable().optional(),
  timeClassification: z.string().max(20).nullable().optional(),
  sixRStrategy: z.string().max(20).nullable().optional(),
  businessCriticality: z.string().max(30).nullable().optional(),
  lifecycleStatus: z.string().max(20).nullable().optional(),
  notes: z.string().max(2000).optional(),
});

export const createOrgUnitSchema = z.object({
  name: z.string().min(1).max(300),
  abbreviation: z.string().max(20).optional(),
  location: z.string().max(200).optional(),
  parentOrgUnitId: z.string().uuid().optional(),
  headUserId: z.string().uuid().optional(),
  headCount: z.number().int().min(0).optional(),
});

export const updateOrgUnitSchema = createOrgUnitSchema.partial();

export const createBusinessContextSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  capabilityId: z.string().uuid().optional(),
  processId: z.string().uuid().optional(),
  orgUnitId: z.string().uuid().optional(),
  applicationIds: z.array(z.string().uuid()).max(100).optional(),
});

export const updateBusinessContextSchema =
  createBusinessContextSchema.partial();
