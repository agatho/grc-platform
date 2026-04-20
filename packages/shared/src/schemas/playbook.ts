import { z } from "zod";

// Sprint 16: Incident Response Playbooks — Zod Schemas

// ─── Enums ─────────────────────────────────────────────────────

export const playbookTriggerCategory = z.enum([
  "ransomware",
  "data_breach",
  "ddos",
  "insider",
  "supply_chain",
  "phishing",
  "other",
]);
export type PlaybookTriggerCategory = z.infer<typeof playbookTriggerCategory>;

export const playbookTriggerSeverity = z.enum([
  "insignificant",
  "significant",
  "emergency",
  "crisis",
  "catastrophe",
]);
export type PlaybookTriggerSeverity = z.infer<typeof playbookTriggerSeverity>;

export const playbookActivationStatus = z.enum([
  "active",
  "completed",
  "aborted",
]);
export type PlaybookActivationStatus = z.infer<typeof playbookActivationStatus>;

export const playbookAssignedRole = z.enum([
  "ciso",
  "it_lead",
  "communications",
  "dpo",
  "legal",
  "hr",
  "admin",
  "risk_manager",
  "control_owner",
  "process_owner",
  "auditor",
]);

// ─── Severity ordering for matching ─────────────────────────────

export const SEVERITY_ORDER: Record<string, number> = {
  insignificant: 0,
  significant: 1,
  emergency: 2,
  crisis: 3,
  catastrophe: 4,
};

// Maps incident severity to playbook severity for matching
export const INCIDENT_TO_PLAYBOOK_SEVERITY: Record<string, string> = {
  low: "insignificant",
  medium: "significant",
  high: "emergency",
  critical: "crisis",
};

// ─── Task Template Schema ───────────────────────────────────────

export const playbookTaskTemplateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  assignedRole: z.string().min(1).max(50),
  deadlineHoursRelative: z.number().int().min(1),
  isCriticalPath: z.boolean().default(false),
  checklistItems: z.array(z.string().max(500)).max(20).optional(),
});

// ─── Phase Schema ───────────────────────────────────────────────

export const playbookPhaseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  deadlineHoursRelative: z.number().int().min(1),
  escalationRoleOnOverdue: z.string().max(50).optional(),
  communicationTemplateKey: z.string().max(100).optional(),
  tasks: z.array(playbookTaskTemplateSchema).min(1).max(50),
});

// ─── Create Playbook Template ───────────────────────────────────

export const createPlaybookTemplateSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  triggerCategory: playbookTriggerCategory,
  triggerMinSeverity: playbookTriggerSeverity.default("significant"),
  estimatedDurationHours: z.number().int().min(1).optional(),
  phases: z.array(playbookPhaseSchema).min(1).max(10),
});

export type CreatePlaybookTemplateInput = z.infer<
  typeof createPlaybookTemplateSchema
>;

// ─── Update Playbook Template ───────────────────────────────────

export const updatePlaybookTemplateSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  triggerCategory: playbookTriggerCategory.optional(),
  triggerMinSeverity: playbookTriggerSeverity.optional(),
  estimatedDurationHours: z.number().int().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  phases: z.array(playbookPhaseSchema).min(1).max(10).optional(),
});

export type UpdatePlaybookTemplateInput = z.infer<
  typeof updatePlaybookTemplateSchema
>;

// ─── Activate Playbook ──────────────────────────────────────────

export const activatePlaybookSchema = z.object({
  templateId: z.string().uuid(),
});

// ─── List Query ─────────────────────────────────────────────────

export const playbookListQuerySchema = z.object({
  triggerCategory: playbookTriggerCategory.optional(),
  isActive: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Types ──────────────────────────────────────────────────────

export interface PlaybookTemplateWithPhases {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  triggerCategory: string;
  triggerMinSeverity: string;
  isActive: boolean;
  estimatedDurationHours: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  phases: PlaybookPhaseWithTasks[];
}

export interface PlaybookPhaseWithTasks {
  id: string;
  templateId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  deadlineHoursRelative: number;
  escalationRoleOnOverdue: string | null;
  communicationTemplateKey: string | null;
  tasks: PlaybookTaskTemplateType[];
}

export interface PlaybookTaskTemplateType {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  assignedRole: string;
  deadlineHoursRelative: number;
  isCriticalPath: boolean;
  sortOrder: number;
  checklistItems: string[];
}

export interface PlaybookActivationType {
  id: string;
  orgId: string;
  templateId: string;
  incidentId: string;
  activatedAt: string;
  activatedBy: string;
  status: string;
  currentPhaseId: string | null;
  completedAt: string | null;
  totalTasksCount: number;
  completedTasksCount: number;
}

export interface PlaybookStatusResponse {
  activation: PlaybookActivationType;
  template: { id: string; name: string; triggerCategory: string };
  currentPhase: {
    id: string;
    name: string;
    sortOrder: number;
    deadlineHoursRelative: number;
    tasksTotal: number;
    tasksCompleted: number;
  } | null;
  phases: Array<{
    id: string;
    name: string;
    sortOrder: number;
    status: "completed" | "active" | "future" | "overdue";
    tasksTotal: number;
    tasksCompleted: number;
  }>;
  timeline: Array<{
    id: string;
    actionType: string;
    description: string;
    occurredAt: string;
  }>;
}

// ─── Helper Functions ───────────────────────────────────────────

export function computeAbsoluteDeadline(
  activationTime: Date,
  relativeHours: number,
): Date {
  return new Date(activationTime.getTime() + relativeHours * 60 * 60 * 1000);
}

export function countTotalTasks(template: {
  phases: Array<{ tasks: unknown[] }>;
}): number {
  return template.phases.reduce((sum, p) => sum + p.tasks.length, 0);
}

export function isPhaseComplete(tasks: Array<{ status: string }>): boolean {
  return (
    tasks.length > 0 &&
    tasks.every((t) => t.status === "done" || t.status === "cancelled")
  );
}

export function getNextPhase<T extends { id: string; sortOrder: number }>(
  currentPhaseId: string,
  phases: T[],
): T | null {
  const sorted = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentIdx = sorted.findIndex((p) => p.id === currentPhaseId);
  if (currentIdx === -1 || currentIdx === sorted.length - 1) return null;
  return sorted[currentIdx + 1];
}

export function matchesSeverityThreshold(
  incidentSeverity: string,
  templateMinSeverity: string,
): boolean {
  const playbookSeverity =
    INCIDENT_TO_PLAYBOOK_SEVERITY[incidentSeverity] ?? "insignificant";
  const incidentLevel = SEVERITY_ORDER[playbookSeverity] ?? 0;
  const templateLevel = SEVERITY_ORDER[templateMinSeverity] ?? 0;
  return incidentLevel >= templateLevel;
}
