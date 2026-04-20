import { z } from "zod";

// Sprint 55: GRC UX Enhancement schemas

// ─── My ToDos Query ───────────────────────────────────────────

export const grcModuleValues = [
  "erm",
  "isms",
  "bcms",
  "ics",
  "audit",
  "dpms",
  "tprm",
  "esg",
] as const;

export const myTodosQuerySchema = z.object({
  module: z.enum(grcModuleValues),
});
export type MyTodosQuery = z.infer<typeof myTodosQuerySchema>;

// ─── Incident Timeline ────────────────────────────────────────

export const timelineEventTypeValues = [
  "detected",
  "reported",
  "escalated",
  "contained",
  "mitigated",
  "resolved",
  "post_mortem",
  "other",
] as const;

export const timelineEntryCreateSchema = z.object({
  event_type: z.enum(timelineEventTypeValues),
  description: z.string().min(1).max(5000),
  occurred_at: z.string().datetime().optional(),
});
export type TimelineEntryCreate = z.infer<typeof timelineEntryCreateSchema>;

// ─── Incident Rating ──────────────────────────────────────────

export const incidentRatingSchema = z.object({
  overall_severity_rating: z.number().int().min(1).max(5),
  response_effectiveness: z.number().int().min(1).max(5),
  communication_quality: z.number().int().min(1).max(5),
  lessons_learned: z.string().max(10000).optional(),
});
export type IncidentRating = z.infer<typeof incidentRatingSchema>;

// ─── Resource Classification ──────────────────────────────────

export const resourceClassificationValues = [
  "critical",
  "significant",
  "non_critical",
] as const;

export const resourceClassificationSchema = z.enum(
  resourceClassificationValues,
);
export type ResourceClassification = z.infer<
  typeof resourceClassificationSchema
>;

// ─── Damage Index ─────────────────────────────────────────────

export const damageIndexInputSchema = z.object({
  confidentiality: z.number().int().min(1).max(4),
  integrity: z.number().int().min(1).max(4),
  availability: z.number().int().min(1).max(4),
  exposureFactor: z.number().int().min(1).max(4),
  severityFactor: z.number().int().min(1).max(4),
});
export type DamageIndexInput = z.infer<typeof damageIndexInputSchema>;

// ─── My ToDos Response Types ──────────────────────────────────

export interface TodoItem {
  id: string;
  elementId: string;
  title: string;
  type:
    | "evaluation"
    | "approval"
    | "overdue"
    | "treatment"
    | "assessment"
    | "review"
    | "incident";
  dueDate: string | null;
  isOverdue: boolean;
  entityType: string;
  link: string;
}

export interface MyTodosResponse {
  module: string;
  totalCount: number;
  overdueCount: number;
  items: TodoItem[];
}
