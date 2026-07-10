import { z } from "zod";
import { RISK_ACCEPTANCE_STATUSES } from "../state-machines/risk-acceptance";

// Risk Acceptance (ISO 27005 Clause 10) — API-Validierung.
// Tabellen: risk_acceptance + risk_acceptance_authority
// (Migration 0088 / Repair 0360).

export const riskAcceptanceStatusSchema = z.enum(RISK_ACCEPTANCE_STATUSES);
export type RiskAcceptanceStatusValue = z.infer<
  typeof riskAcceptanceStatusSchema
>;

// ─── Create (POST /api/v1/risks/:id/acceptance) ───────────────────────

export const createRiskAcceptanceSchema = z.object({
  // Pflicht nach ISO 27005 — landet in risk_acceptance.justification
  justification: z.string().min(10).max(5000),
  // Auflagen unter denen akzeptiert wird (optional)
  acceptanceConditions: z.string().max(5000).optional(),
  // Zeitlich befristete Akzeptanz (ISO-Date, YYYY-MM-DD)
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date (YYYY-MM-DD)")
    .optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
});
export type CreateRiskAcceptanceInput = z.infer<
  typeof createRiskAcceptanceSchema
>;

// ─── Revoke (PATCH /api/v1/risks/:id/acceptance/:acceptanceId/revoke) ─

export const revokeRiskAcceptanceSchema = z.object({
  reason: z.string().min(10).max(2000),
});
export type RevokeRiskAcceptanceInput = z.infer<
  typeof revokeRiskAcceptanceSchema
>;

// ─── Update (PATCH /api/v1/risk-acceptances/:id) ──────────────────────
// Nur Auflagen/Befristung sind nachtraeglich aenderbar — Score-Snapshot,
// Begruendung und Status sind Audit-Artefakte (Status nur via Revoke-Route
// bzw. Expiry-Cron).

export const updateRiskAcceptanceSchema = z
  .object({
    acceptanceConditions: z.string().max(5000).nullable().optional(),
    validUntil: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date (YYYY-MM-DD)")
      .nullable()
      .optional(),
    tags: z.array(z.string().max(100)).max(20).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateRiskAcceptanceInput = z.infer<
  typeof updateRiskAcceptanceSchema
>;

// ─── List query (GET /api/v1/risk-acceptances) ────────────────────────

export const riskAcceptanceListQuerySchema = z.object({
  status: riskAcceptanceStatusSchema.optional(),
  riskId: z.string().uuid().optional(),
  // Nur Akzeptanzen, deren Befristung vor diesem Datum ablaeuft
  // (Review-Cockpit: "was laeuft in den naechsten 30 Tagen ab?")
  expiringBefore: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date (YYYY-MM-DD)")
    .optional(),
  sort: z.enum(["acceptedAt", "validUntil", "status"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});
export type RiskAcceptanceListQuery = z.infer<
  typeof riskAcceptanceListQuerySchema
>;

// ─── Authority matrix (PUT /api/v1/risk-acceptance/authority) ─────────

export const acceptanceAuthorityRoleValues = [
  "admin",
  "risk_manager",
  "control_owner",
  "process_owner",
  "ciso",
  "dpo",
] as const;

export const acceptanceAuthorityEntrySchema = z
  .object({
    minScore: z.number().int().min(0).max(25).default(0),
    maxScore: z.number().int().min(1).max(25),
    requiredRole: z.enum(acceptanceAuthorityRoleValues),
    requiredRoleLabel: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.minScore <= v.maxScore, {
    message: "minScore must be <= maxScore",
  });

export const upsertAcceptanceAuthoritySchema = z.object({
  entries: z.array(acceptanceAuthorityEntrySchema).min(1).max(10),
});
export type UpsertAcceptanceAuthorityInput = z.infer<
  typeof upsertAcceptanceAuthoritySchema
>;
