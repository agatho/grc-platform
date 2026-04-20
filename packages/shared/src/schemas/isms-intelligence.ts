import { z } from "zod";

// Sprint 26: ISMS Intelligence — CVE Feed, AI SoA Gap, AI Maturity Roadmap

// ─── CVE Enums ───────────────────────────────────────────────

export const cveSeverity = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "none",
]);
export const cveMatchStatus = z.enum([
  "new",
  "acknowledged",
  "mitigated",
  "not_applicable",
]);
export const soaGapType = z.enum(["not_covered", "partial", "full"]);
export const soaSuggestionStatus = z.enum(["pending", "accepted", "rejected"]);
export const soaGapPriority = z.enum(["critical", "high", "medium", "low"]);
export const roadmapEffort = z.enum(["S", "M", "L"]);
export const roadmapActionStatus = z.enum([
  "proposed",
  "in_progress",
  "completed",
  "dismissed",
]);

// ─── CVE Match Status Transitions ────────────────────────────

export const cveMatchStatusTransitions: Record<string, string[]> = {
  new: ["acknowledged", "not_applicable"],
  acknowledged: ["mitigated", "not_applicable"],
  mitigated: [],
  not_applicable: [],
};

export function isValidCveMatchTransition(from: string, to: string): boolean {
  return cveMatchStatusTransitions[from]?.includes(to) ?? false;
}

// ─── Asset CPE Assignment ────────────────────────────────────

export const assignAssetCpeSchema = z.object({
  assetId: z.string().uuid(),
  cpeUri: z
    .string()
    .min(5)
    .max(500)
    .regex(/^cpe:2\.3:[aoh]:/i, {
      message: "CPE URI must follow CPE 2.3 format (cpe:2.3:[a|h|o]:...)",
    }),
  vendor: z.string().max(200).optional(),
  product: z.string().max(200).optional(),
  version: z.string().max(100).optional(),
});

export const removeAssetCpeSchema = z.object({
  cpeId: z.string().uuid(),
});

// ─── CVE Match Acknowledge ───────────────────────────────────

export const acknowledgeCveMatchSchema = z.object({
  status: cveMatchStatus.refine((val) => val !== "new", {
    message: "Cannot set status to new",
  }),
});

// ─── CVE to Vulnerability Conversion ─────────────────────────

export const convertCveToVulnerabilitySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  affectedAssetId: z.string().uuid().optional(),
});

// ─── AI SoA Gap Analysis ─────────────────────────────────────

export const triggerSoaGapAnalysisSchema = z.object({
  framework: z.string().min(1).max(100).default("iso27001"),
});

export const reviewSoaSuggestionSchema = z.object({
  status: z.enum(["accepted", "rejected"]),
  controlId: z.string().uuid().optional(), // if accepting and mapping to a control
});

// ─── AI Maturity Roadmap ─────────────────────────────────────

export const triggerMaturityRoadmapSchema = z.object({
  targetMaturity: z.number().int().min(1).max(5).default(3),
});

export const updateRoadmapActionStatusSchema = z.object({
  status: roadmapActionStatus,
});

// ─── CVE Feed Query ──────────────────────────────────────────

export const cveQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  severity: cveSeverity.optional(),
  search: z.string().max(200).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const cveMatchQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: cveMatchStatus.optional(),
  severity: cveSeverity.optional(),
});

// ─── Bulk CVE Match Status Update ────────────────────────────

export const bulkCveMatchStatusSchema = z.object({
  matchIds: z.array(z.string().uuid()).min(1).max(100),
  status: cveMatchStatus.refine((val) => val !== "new", {
    message: "Cannot bulk-set status to new",
  }),
});
