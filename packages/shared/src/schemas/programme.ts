// Zod schemas for the Programme Cockpit module.
// Bezug: docs/isms-bcms/10-programme-cockpit-implementation-plan.md

import { z } from "zod";

import {
  PROGRAMME_JOURNEY_STATUSES,
  type ProgrammeJourneyStatus,
} from "../state-machines/programme-journey";
import {
  PROGRAMME_STEP_STATUSES,
  type ProgrammeStepStatus,
} from "../state-machines/programme-step";

export const MS_TYPE_VALUES = [
  "isms",
  "bcms",
  "dpms",
  "aims",
  "esg",
  "tcms",
  "iccs",
  "other",
] as const;
export type MsType = (typeof MS_TYPE_VALUES)[number];

export const PDCA_PHASE_VALUES = [
  "plan",
  "do",
  "check",
  "act",
  "continuous",
] as const;
export type PdcaPhase = (typeof PDCA_PHASE_VALUES)[number];

// ──────────────────────────────────────────────────────────────
// Sub-schemas
// ──────────────────────────────────────────────────────────────

export const evidenceLinkSchema = z.object({
  type: z.string().min(1).max(50),
  id: z.string().uuid(),
  label: z.string().max(300).optional(),
  url: z.string().url().optional(),
});
export type EvidenceLink = z.infer<typeof evidenceLinkSchema>;

export const targetModuleLinkSchema = z.object({
  module: z.string().min(1).max(50).optional(),
  route: z.string().max(500).optional(),
  entityType: z.string().max(50).optional(),
  createIfMissing: z.boolean().optional(),
});
export type TargetModuleLink = z.infer<typeof targetModuleLinkSchema>;

// ──────────────────────────────────────────────────────────────
// Journey input schemas
// ──────────────────────────────────────────────────────────────

export const createJourneySchema = z.object({
  templateCode: z.string().min(1).max(50),
  templateVersion: z.string().min(1).max(20).optional(),
  name: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  ownerId: z.string().uuid().optional(),
  sponsorId: z.string().uuid().optional(),
  startedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  targetCompletionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateJourneyInput = z.infer<typeof createJourneySchema>;

export const updateJourneySchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  sponsorId: z.string().uuid().nullable().optional(),
  startedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  targetCompletionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateJourneyInput = z.infer<typeof updateJourneySchema>;

export const journeyTransitionSchema = z.object({
  to: z.enum(PROGRAMME_JOURNEY_STATUSES),
  reason: z.string().max(1000).optional(),
});

// ──────────────────────────────────────────────────────────────
// Step input schemas
// ──────────────────────────────────────────────────────────────

export const updateStepSchema = z.object({
  ownerId: z.string().uuid().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  completionNotes: z.string().max(5000).optional(),
  // Cost + effort tracking (Sprint 4)
  costEstimate: z.number().min(0).max(99999999).nullable().optional(),
  costActual: z.number().min(0).max(99999999).nullable().optional(),
  costCurrency: z.string().length(3).optional(),
  effortHours: z.number().int().min(0).max(99999).nullable().optional(),
  budgetId: z.string().uuid().nullable().optional(),
});
export type UpdateStepInput = z.infer<typeof updateStepSchema>;

export const stepTransitionSchema = z.object({
  to: z.enum(PROGRAMME_STEP_STATUSES),
  reason: z.string().max(1000).optional(),
  completionNotes: z.string().max(5000).optional(),
});

export const addEvidenceSchema = z.object({
  type: z.string().min(1).max(50),
  id: z.string().uuid(),
  label: z.string().max(300).optional(),
  url: z.string().url().optional(),
});

export const removeEvidenceSchema = z.object({
  index: z.number().int().min(0).max(999),
});

// ──────────────────────────────────────────────────────────────
// Re-Exports of state-machine status arrays + types
// ──────────────────────────────────────────────────────────────

export { PROGRAMME_JOURNEY_STATUSES, PROGRAMME_STEP_STATUSES };
export type { ProgrammeJourneyStatus, ProgrammeStepStatus };
