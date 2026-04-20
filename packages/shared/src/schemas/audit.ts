import { z } from "zod";

// Sprint 8: Audit Management schemas

const auditTypeValues = [
  "internal",
  "external",
  "certification",
  "surveillance",
  "follow_up",
] as const;
const auditStatusValues = [
  "planned",
  "preparation",
  "fieldwork",
  "reporting",
  "review",
  "completed",
  "cancelled",
] as const;
const auditPlanStatusValues = [
  "draft",
  "approved",
  "active",
  "completed",
] as const;
const checklistResultValues = [
  "conforming",
  "nonconforming",
  "observation",
  "not_applicable",
] as const;
const auditConclusionValues = [
  "conforming",
  "minor_nonconformity",
  "major_nonconformity",
  "not_applicable",
] as const;
const universeEntityTypeValues = [
  "process",
  "department",
  "it_system",
  "vendor",
  "custom",
] as const;
const checklistSourceTypeValues = [
  "auto_controls",
  "template",
  "custom",
] as const;

// ─── Audit Status Transitions ────────────────────────────────

export const VALID_AUDIT_STATUS_TRANSITIONS: Record<string, string[]> = {
  planned: ["preparation", "cancelled"],
  preparation: ["fieldwork", "planned", "cancelled"],
  fieldwork: ["reporting", "cancelled"],
  reporting: ["review", "cancelled"],
  review: ["completed", "reporting"],
  completed: [],
  cancelled: [],
};

export function isValidAuditTransition(from: string, to: string): boolean {
  return VALID_AUDIT_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Audit Universe Entry ────────────────────────────────────

export const createAuditUniverseEntrySchema = z.object({
  name: z.string().min(1).max(500),
  entityType: z.enum(universeEntityTypeValues),
  entityId: z.string().uuid().optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
  lastAuditDate: z.string().optional(),
  auditCycleMonths: z.number().int().min(1).max(120).default(12),
  nextAuditDue: z.string().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
});

export const updateAuditUniverseEntrySchema =
  createAuditUniverseEntrySchema.partial();

// ─── Audit Plan ──────────────────────────────────────────────

export const createAuditPlanSchema = z.object({
  name: z.string().min(1).max(500),
  year: z.number().int().min(2020).max(2100),
  description: z.string().optional(),
  totalPlannedDays: z.number().int().positive().optional(),
});

export const updateAuditPlanSchema = createAuditPlanSchema.partial();

// ─── Audit Plan Item ─────────────────────────────────────────

export const createAuditPlanItemSchema = z.object({
  auditPlanId: z.string().uuid(),
  universeEntryId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  scopeDescription: z.string().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  estimatedDays: z.number().int().positive().optional(),
  leadAuditorId: z.string().uuid().optional(),
});

// ─── Audit ───────────────────────────────────────────────────

export const createAuditSchema = z.object({
  auditPlanItemId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  auditType: z.enum(auditTypeValues).default("internal"),
  scopeDescription: z.string().optional(),
  scopeProcesses: z.array(z.string()).optional(),
  scopeDepartments: z.array(z.string()).optional(),
  scopeFrameworks: z.array(z.string()).optional(),
  leadAuditorId: z.string().uuid().optional(),
  auditorIds: z.array(z.string().uuid()).optional(),
  auditeeId: z.string().uuid().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
});

export const updateAuditSchema = createAuditSchema.partial();

export const auditStatusTransitionSchema = z.object({
  status: z.enum(auditStatusValues),
  conclusion: z.enum(auditConclusionValues).optional(),
});

// ─── Audit Checklist ─────────────────────────────────────────

export const createAuditChecklistSchema = z.object({
  auditId: z.string().uuid(),
  name: z.string().min(1).max(500),
  sourceType: z.enum(checklistSourceTypeValues).optional(),
});

// ─── Checklist Item Evaluation ───────────────────────────────

export const evaluateChecklistItemSchema = z.object({
  result: z.enum(checklistResultValues),
  notes: z.string().optional(),
  evidenceIds: z.array(z.string().uuid()).optional(),
});
