import { z } from "zod";

// Sprint 56: BPM UX & Derived Views schemas

// ─── RACI Roles ───────────────────────────────────────────────

export const raciRoleValues = ["R", "A", "C", "I"] as const;
export const raciRoleSchema = z.enum(raciRoleValues);
export type RACIRole = z.infer<typeof raciRoleSchema>;

// ─── RACI Override ────────────────────────────────────────────

export const raciOverrideSchema = z.object({
  activityBpmnId: z.string().min(1).max(100),
  participantBpmnId: z.string().min(1).max(100),
  raciRole: raciRoleSchema,
});
export type RACIOverride = z.infer<typeof raciOverrideSchema>;

// ─── RACI Matrix Entry ───────────────────────────────────────

export interface RACIEntry {
  activityId: string;
  activityName: string;
  participantId: string;
  participantName: string;
  role: RACIRole;
  isOverride: boolean;
  documents: string[];
  applications: string[];
  risks: string[];
}

export interface RACIMatrix {
  activities: { id: string; name: string }[];
  participants: { id: string; name: string }[];
  entries: RACIEntry[];
}

// ─── Walkthrough Step ─────────────────────────────────────────

export interface DecisionOption {
  label: string;
  targetStepNumber: number;
}

export interface WalkthroughStep {
  stepNumber: number;
  type: "task" | "decision" | "event";
  name: string;
  bpmnId: string;
  responsible: string;
  documents: string[];
  applications: string[];
  decisionOptions?: DecisionOption[];
}

// ─── Process Health ───────────────────────────────────────────

export const processHealthValues = ["healthy", "warning", "critical"] as const;
export const processHealthSchema = z.enum(processHealthValues);
export type ProcessHealth = z.infer<typeof processHealthSchema>;

export const updateProcessHealthSchema = z.object({
  processHealth: processHealthSchema,
});
export type UpdateProcessHealth = z.infer<typeof updateProcessHealthSchema>;

// ─── Metro Layout ─────────────────────────────────────────────

export const metroStationSchema = z.object({
  processId: z.string().uuid(),
  x: z.number(),
  y: z.number(),
  lineColor: z.string().max(20).optional(),
});

export const metroLayoutSchema = z.object({
  stations: z.array(metroStationSchema),
});
export type MetroLayout = z.infer<typeof metroLayoutSchema>;

export interface MetroStation {
  processId: string;
  processName: string;
  health: string;
  x: number;
  y: number;
  lineColor: string;
  connections: string[];
}

export interface MetroMapData {
  stations: MetroStation[];
  lines: { id: string; name: string; color: string; stationIds: string[] }[];
}

// ─── Excel Import ─────────────────────────────────────────────

export interface ExcelImportResult {
  bpmnXml: string;
  activityCount: number;
  laneCount: number;
  warnings: string[];
  errors: string[];
}

// ─── Reader Mode ──────────────────────────────────────────────

export interface MyBPMHomepageData {
  recentlyViewed: { id: string; name: string; lastViewed: string }[];
  ownedProcesses: {
    id: string;
    name: string;
    status: string;
    health: string;
  }[];
  pendingGovernance: { id: string; name: string; action: string }[];
}
