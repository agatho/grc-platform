import { z } from "zod";

// Sprint 1.4: Asset & Work Item schemas

const ciaScale = z.number().int().min(1).max(4);

export const createAssetSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  assetTier: z
    .enum(["business_structure", "primary_asset", "supporting_asset"])
    .default("supporting_asset"),
  codeGroup: z.string().max(100).optional(),
  defaultConfidentiality: ciaScale.nullable().optional(),
  defaultIntegrity: ciaScale.nullable().optional(),
  defaultAvailability: ciaScale.nullable().optional(),
  defaultAuthenticity: ciaScale.nullable().optional(),
  defaultReliability: ciaScale.nullable().optional(),
  contactPerson: z.string().max(255).optional(),
  dataProtectionResponsible: z.string().max(255).optional(),
  dpoEmail: z.string().email().optional(),
  latestAuditDate: z.string().optional(),
  latestAuditResult: z.string().max(50).optional(),
  parentAssetId: z.string().uuid().nullable().optional(),
  visibleInModules: z.array(z.string()).default([]),
});

export const updateAssetSchema = createAssetSchema.partial();

export const workItemStatusTransitionSchema = z.object({
  status: z.enum([
    "draft",
    "in_evaluation",
    "in_review",
    "in_approval",
    "management_approved",
    "active",
    "in_treatment",
    "completed",
    "obsolete",
    "cancelled",
  ]),
});

export const createWorkItemSchema = z.object({
  typeKey: z.string().min(1).max(50),
  name: z.string().min(1).max(500),
  status: z
    .enum([
      "draft",
      "in_evaluation",
      "in_review",
      "in_approval",
      "management_approved",
      "active",
      "in_treatment",
      "completed",
      "obsolete",
      "cancelled",
    ])
    .default("draft"),
  responsibleId: z.string().uuid().optional(),
  reviewerId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  grcPerspective: z.array(z.string()).default([]),
});

export const updateWorkItemSchema = createWorkItemSchema
  .partial()
  .omit({ typeKey: true });

export const createWorkItemLinkSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  linkType: z.string().max(50).default("related"),
  linkContext: z.string().optional(),
});
