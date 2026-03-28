import { z } from "zod";

// Sprint 28: GRC Workflow Automation Engine Zod schemas

// ─── Enums ──────────────────────────────────────────────────

export const automationTriggerTypeValues = [
  "entity_change",
  "deadline_expired",
  "score_threshold",
  "periodic",
] as const;

export const automationActionTypeValues = [
  "create_task",
  "send_notification",
  "send_email",
  "change_status",
  "escalate",
  "trigger_webhook",
] as const;

export const conditionOperatorValues = ["AND", "OR"] as const;

export const conditionComparisonOpValues = [
  ">",
  "<",
  "=",
  "!=",
  "contains",
  "not_contains",
  "days_since",
  ">=",
  "<=",
] as const;

export const automationExecutionStatusValues = [
  "success",
  "partial_failure",
  "failure",
  "skipped_cooldown",
  "skipped_ratelimit",
  "dry_run",
] as const;

export const automationTemplateCategoryValues = [
  "risk_management",
  "control_testing",
  "vendor_management",
  "audit",
  "data_protection",
  "compliance",
  "isms",
  "esg",
] as const;

// ─── Trigger Config ─────────────────────────────────────────

export const automationTriggerConfigSchema = z.object({
  entityType: z.string().min(1).max(50),
  events: z
    .array(z.enum(["created", "updated", "deleted", "status_changed"]))
    .optional(),
  field: z.string().max(100).optional(),
  schedule: z.string().max(100).optional(),
});

// ─── Condition Schemas (recursive) ──────────────────────────

const conditionRuleSchema = z.object({
  field: z.string().min(1).max(100),
  op: z.enum(conditionComparisonOpValues),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

// Recursive condition group with max depth of 5
const baseConditionGroupSchema = z.object({
  operator: z.enum(conditionOperatorValues),
});

type ConditionGroupInput = z.infer<typeof baseConditionGroupSchema> & {
  rules: (z.infer<typeof conditionRuleSchema> | ConditionGroupInput)[];
};

export const conditionGroupSchema: z.ZodType<ConditionGroupInput> = baseConditionGroupSchema.extend({
  rules: z.lazy(() =>
    z
      .array(z.union([conditionRuleSchema, conditionGroupSchema]))
      .min(1)
      .max(50),
  ),
});

// ─── Action Config Schemas ──────────────────────────────────

export const createTaskActionConfigSchema = z.object({
  title: z.string().min(1).max(500),
  assigneeRole: z.string().min(1).max(50),
  deadlineDays: z.number().int().min(1).max(365),
  description: z.string().max(2000).optional(),
});

export const sendNotificationActionConfigSchema = z.object({
  role: z.string().min(1).max(50),
  message: z.string().min(1).max(2000),
});

export const sendEmailActionConfigSchema = z.object({
  templateKey: z.string().min(1).max(100),
  recipientRole: z.string().min(1).max(50),
});

export const changeStatusActionConfigSchema = z.object({
  newStatus: z.string().min(1).max(50),
});

export const escalateActionConfigSchema = z.object({
  targetRole: z.string().min(1).max(50),
  message: z.string().min(1).max(2000),
});

export const triggerWebhookActionConfigSchema = z.object({
  webhookId: z.string().uuid(),
});

export const automationActionSchema = z.object({
  type: z.enum(automationActionTypeValues),
  config: z.union([
    createTaskActionConfigSchema,
    sendNotificationActionConfigSchema,
    sendEmailActionConfigSchema,
    changeStatusActionConfigSchema,
    escalateActionConfigSchema,
    triggerWebhookActionConfigSchema,
  ]),
});

// ─── Rule CRUD Schemas ──────────────────────────────────────

export const createAutomationRuleSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  triggerType: z.enum(automationTriggerTypeValues),
  triggerConfig: automationTriggerConfigSchema,
  conditions: conditionGroupSchema,
  actions: z.array(automationActionSchema).min(1).max(20),
  cooldownMinutes: z.number().int().min(0).max(1440).default(60),
  maxExecutionsPerHour: z.number().int().min(1).max(1000).default(100),
});

export const updateAutomationRuleSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  triggerType: z.enum(automationTriggerTypeValues).optional(),
  triggerConfig: automationTriggerConfigSchema.optional(),
  conditions: conditionGroupSchema.optional(),
  actions: z.array(automationActionSchema).min(1).max(20).optional(),
  cooldownMinutes: z.number().int().min(0).max(1440).optional(),
  maxExecutionsPerHour: z.number().int().min(1).max(1000).optional(),
});

export const activateRuleSchema = z.object({
  isActive: z.boolean(),
});

// ─── Execution Query Schema ─────────────────────────────────

export const automationExecutionQuerySchema = z.object({
  ruleId: z.string().uuid().optional(),
  status: z.enum(automationExecutionStatusValues).optional(),
  entityType: z.string().max(50).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Rule List Query Schema ─────────────────────────────────

export const automationRuleQuerySchema = z.object({
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  triggerType: z.enum(automationTriggerTypeValues).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Template Query Schema ──────────────────────────────────

export const automationTemplateQuerySchema = z.object({
  category: z.enum(automationTemplateCategoryValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Dry-Run Test Schema ────────────────────────────────────

export const automationDryRunSchema = z.object({
  entityType: z.string().min(1).max(50).optional(),
  entityId: z.string().uuid().optional(),
});

// Re-export enum arrays
export {
  automationTriggerTypeValues as triggerTypes,
  automationActionTypeValues as actionTypes,
  automationTemplateCategoryValues as templateCategories,
};
