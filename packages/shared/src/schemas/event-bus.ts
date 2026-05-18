import { z } from "zod";
import { checkWebhookUrl } from "../url-safety";

// Sprint 22: Where-Used + Event Bus / Webhook Zod schemas

// SSRF guard: applied to all webhook URL fields. Rejects literal
// localhost / private / link-local / cloud-metadata hosts at validation
// time. Same check runs again in the worker before delivery (defence-
// in-depth). See packages/shared/src/url-safety.ts.
const safeWebhookUrl = z
  .string()
  .url()
  .max(2000)
  .superRefine((val, ctx) => {
    const r = checkWebhookUrl(val);
    if (!r.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: r.reason,
      });
    }
  });

// ─── Entity Reference ───────────────────────────────────────

const entityTypeValues = [
  "risk",
  "control",
  "process",
  "process_step",
  "asset",
  "vendor",
  "contract",
  "document",
  "finding",
  "incident",
  "audit",
  "kri",
  "bcp",
  "ropa_entry",
  "dpia",
] as const;

const relationshipValues = [
  "mitigates",
  "linked_to",
  "depends_on",
  "owned_by",
  "documented_in",
  "tested_by",
  "assessed_in",
  "affects",
  "implemented_in",
  "found_in",
  "bound_by",
  "affected",
] as const;

export const entityReferenceQuerySchema = z.object({
  entityType: z.enum(entityTypeValues),
  entityId: z.string().uuid(),
});

export const impactQuerySchema = z.object({
  entityType: z.enum(entityTypeValues),
  entityId: z.string().uuid(),
  maxDepth: z.coerce.number().int().min(1).max(5).default(3),
});

export const referenceStatsQuerySchema = z.object({
  entityType: z.enum(entityTypeValues).optional(),
});

// ─── Event Log ──────────────────────────────────────────────

const eventTypeValues = [
  "entity.created",
  "entity.updated",
  "entity.deleted",
  "entity.status_changed",
] as const;

export const eventLogQuerySchema = z.object({
  entityType: z.enum(entityTypeValues).optional(),
  eventType: z.enum(eventTypeValues).optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Webhook Registration ───────────────────────────────────

const templateTypeValues = ["generic", "slack", "teams"] as const;

export const eventFilterSchema = z.object({
  entityTypes: z.array(z.string()).optional(),
  events: z.array(z.string()).optional(),
});

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(200),
  url: safeWebhookUrl,
  eventFilter: eventFilterSchema,
  headers: z.record(z.string()).optional(),
  templateType: z.enum(templateTypeValues).default("generic"),
});

export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: safeWebhookUrl.optional(),
  eventFilter: eventFilterSchema.optional(),
  headers: z.record(z.string()).optional(),
  isActive: z.boolean().optional(),
  templateType: z.enum(templateTypeValues).optional(),
});

export const webhookDeliveryQuerySchema = z.object({
  status: z.enum(["pending", "delivered", "failed", "retrying"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Re-export enum arrays for UI
export {
  entityTypeValues,
  relationshipValues,
  eventTypeValues,
  templateTypeValues,
};
