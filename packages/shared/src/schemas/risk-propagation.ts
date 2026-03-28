import { z } from "zod";

// Sprint 32: Risk Propagation + Incident Correlation Zod schemas

// ──────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────

export const orgRelationshipTypeValues = [
  "shared_it",
  "shared_vendor",
  "shared_process",
  "financial_dependency",
  "data_flow",
] as const;

export const correlationTypeValues = [
  "temporal",
  "asset",
  "pattern",
  "mitre",
] as const;

// ──────────────────────────────────────────────────────────────
// Org Entity Relationship
// ──────────────────────────────────────────────────────────────

export const createOrgRelationshipSchema = z.object({
  sourceOrgId: z.string().uuid(),
  targetOrgId: z.string().uuid(),
  relationshipType: z.enum(orgRelationshipTypeValues),
  strength: z.number().int().min(0).max(100),
  description: z.string().max(2000).optional(),
});

export const updateOrgRelationshipSchema = z.object({
  strength: z.number().int().min(0).max(100).optional(),
  description: z.string().max(2000).optional(),
});

// ──────────────────────────────────────────────────────────────
// Propagation Simulation
// ──────────────────────────────────────────────────────────────

export const propagationSimulateSchema = z.object({
  riskId: z.string().uuid(),
  simulatedLikelihood: z.number().min(1).max(5).optional().default(5),
});

// ──────────────────────────────────────────────────────────────
// Correlation Analysis
// ──────────────────────────────────────────────────────────────

export const runCorrelationSchema = z.object({
  windowDays: z.number().int().min(7).max(365).optional().default(90),
  minConfidence: z.number().int().min(0).max(100).optional().default(50),
});

export const correlationTimelineSchema = z.object({
  periodDays: z.enum(["7", "30", "90", "365"]).optional().default("90"),
});
