import { z } from "zod";

// ── Sprint 61: Multi-Tenant SaaS und Metering ──

// Subscription Plan
export const createSubscriptionPlanSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  tier: z.enum(["free", "standard", "professional", "enterprise"]),
  priceMonthly: z.number().int().min(0).optional(),
  priceYearly: z.number().int().min(0).optional(),
  currency: z.string().length(3).default("EUR"),
  maxUsers: z.number().int().min(-1).optional(),
  maxOrganizations: z.number().int().min(-1).optional(),
  maxStorageGb: z.number().int().min(-1).optional(),
  maxApiCallsPerMonth: z.number().int().min(-1).optional(),
  features: z.record(z.unknown()).default({}),
  isPublic: z.boolean().default(true),
  trialDays: z.number().int().min(0).max(365).default(0),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema
  .partial()
  .omit({ key: true });

// Org Subscription
export const createOrgSubscriptionSchema = z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
  paymentMethod: z.enum(["invoice", "credit_card", "sepa"]).optional(),
  externalCustomerId: z.string().max(255).optional(),
});

export const updateOrgSubscriptionSchema = z.object({
  planId: z.string().uuid().optional(),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
  paymentMethod: z.enum(["invoice", "credit_card", "sepa"]).optional(),
  cancelReason: z.string().max(2000).optional(),
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().max(2000).optional(),
  cancelAtPeriodEnd: z.boolean().default(true),
});

// Usage Record
export const recordUsageSchema = z.object({
  meterKey: z.string().min(1).max(100),
  quantity: z.number().min(0),
  metadata: z.record(z.unknown()).default({}),
});

export const bulkRecordUsageSchema = z.object({
  records: z
    .array(
      z.object({
        meterKey: z.string().min(1).max(100),
        quantity: z.number().min(0),
        metadata: z.record(z.unknown()).default({}),
      }),
    )
    .min(1)
    .max(100),
});

// Feature Gate
export const createFeatureGateSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  module: z.string().max(50).optional(),
  gateType: z.enum(["boolean", "numeric", "string"]).default("boolean"),
  defaultValue: z.unknown().default(false),
  planOverrides: z.record(z.unknown()).default({}),
});

export const updateFeatureGateSchema = createFeatureGateSchema
  .partial()
  .omit({ key: true });

// Usage Query
export const usageQuerySchema = z.object({
  meterKey: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  granularity: z
    .enum(["hourly", "daily", "weekly", "monthly"])
    .default("daily"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Billing Query
export const billingQuerySchema = z.object({
  status: z
    .enum(["draft", "pending", "paid", "overdue", "cancelled"])
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSubscriptionPlanInput = z.infer<
  typeof createSubscriptionPlanSchema
>;
export type UpdateSubscriptionPlanInput = z.infer<
  typeof updateSubscriptionPlanSchema
>;
export type CreateOrgSubscriptionInput = z.infer<
  typeof createOrgSubscriptionSchema
>;
export type UpdateOrgSubscriptionInput = z.infer<
  typeof updateOrgSubscriptionSchema
>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type RecordUsageInput = z.infer<typeof recordUsageSchema>;
export type BulkRecordUsageInput = z.infer<typeof bulkRecordUsageSchema>;
export type CreateFeatureGateInput = z.infer<typeof createFeatureGateSchema>;
export type UpdateFeatureGateInput = z.infer<typeof updateFeatureGateSchema>;
export type UsageQueryInput = z.infer<typeof usageQuerySchema>;
export type BillingQueryInput = z.infer<typeof billingQuerySchema>;
