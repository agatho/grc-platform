import { z } from "zod";

// Sprint 17: Compliance Calendar Zod Schemas

// ──────────── Calendar Event (Manual) ────────────

export const createCalendarEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  isAllDay: z.boolean().default(false),
  eventType: z.enum(["meeting", "workshop", "review", "training", "deadline", "other"]),
  module: z.string().max(20).optional(),
  recurrence: z.enum(["none", "weekly", "monthly", "quarterly", "annually"]).default("none"),
  recurrenceEndAt: z.string().datetime().optional(),
});

export const updateCalendarEventSchema = createCalendarEventSchema.partial();

// ──────────── Calendar Query Filters ────────────

export const calendarQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  modules: z.string().optional(), // comma-separated module keys
  responsible: z.string().uuid().optional(),
  eventType: z.string().optional(), // comma-separated event types
  status: z.enum(["open", "overdue", "completed"]).optional(),
});

export const capacityHeatmapQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  modules: z.string().optional(),
});

// ──────────── Module Color Map ────────────

export const MODULE_COLORS: Record<string, string> = {
  erm: "#EF4444",       // Red
  isms: "#3B82F6",      // Blue
  dpms: "#8B5CF6",      // Purple
  audit: "#F97316",     // Orange
  tprm: "#14B8A6",      // Teal
  bcms: "#166534",      // Dark Green
  esg: "#86EFAC",       // Light Green
  ics: "#EAB308",       // Yellow
  rcsa: "#EC4899",      // Pink
  manual: "#6B7280",    // Gray
};

// ──────────── Event Source Types ────────────

export const CALENDAR_EVENT_SOURCES = [
  "audit_plan",
  "control_test",
  "dsr_deadline",
  "breach_deadline",
  "contract_expiry",
  "ropa_review",
  "bcp_exercise",
  "esg_deadline",
  "rcsa_deadline",
  "manual",
] as const;

export type CalendarEventSource = (typeof CALENDAR_EVENT_SOURCES)[number];
