import { z } from "zod";

// Sprint 43: Audit Advanced — Zod Schemas

// ─── Working Paper Folders ──────────────────────────────────
export const createWpFolderSchema = z.object({
  code: z.string().min(1).max(20),
  title: z.string().min(1).max(500),
  parentFolderId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateWpFolderSchema = createWpFolderSchema.partial();

// ─── Working Papers ─────────────────────────────────────────
export const createWorkingPaperSchema = z.object({
  folderId: z.string().uuid(),
  title: z.string().min(1).max(500),
  objective: z.string().max(5000).optional(),
  scope: z.string().max(5000).optional(),
  procedurePerformed: z.string().max(50000).optional(),
  results: z.string().max(50000).optional(),
  conclusion: z.string().max(10000).optional(),
  evidenceDocumentIds: z.array(z.string().uuid()).max(50).optional(),
  crossReferenceWpIds: z.array(z.string().uuid()).max(20).optional(),
  crossReferenceFindingIds: z.array(z.string().uuid()).max(20).optional(),
});

export const updateWorkingPaperSchema = createWorkingPaperSchema.partial();

// ─── WP Workflow Transitions ────────────────────────────────
export const WP_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["in_review"],
  in_review: ["reviewed", "needs_revision"],
  needs_revision: ["in_review"],
  reviewed: ["approved"],
  approved: [],
};

export function isValidWpTransition(current: string, next: string): boolean {
  return WP_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}

export const wpTransitionSchema = z.object({
  newStatus: z.enum(["in_review", "needs_revision", "reviewed", "approved"]),
  reviewedBy: z.string().uuid().optional(),
  approvedBy: z.string().uuid().optional(),
});

// ─── Review Notes ───────────────────────────────────────────
export const createReviewNoteSchema = z.object({
  section: z.enum([
    "objective",
    "scope",
    "procedure",
    "results",
    "conclusion",
    "general",
  ]),
  noteText: z.string().min(1).max(5000),
  severity: z.enum(["informational", "requires_action", "blocking"]),
});

export const resolveReviewNoteSchema = z.object({
  status: z.enum(["addressed", "closed"]),
});

export const createReviewNoteReplySchema = z.object({
  replyText: z.string().min(1).max(5000),
});

// ─── Auditor Profiles ───────────────────────────────────────
export const createAuditorProfileSchema = z.object({
  userId: z.string().uuid(),
  seniority: z.enum(["staff", "senior", "manager", "director", "cae"]),
  certifications: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        issuer: z.string().max(200).optional(),
        issuedAt: z.string().date().optional(),
        expiresAt: z.string().date().optional(),
      }),
    )
    .max(20)
    .optional(),
  skills: z.array(z.string().max(50)).max(20).optional(),
  availableHoursYear: z.number().int().min(0).max(2500).default(1600),
  hourlyRate: z.number().min(0).max(1000).optional(),
  team: z.string().max(100).optional(),
});

export const updateAuditorProfileSchema = createAuditorProfileSchema
  .omit({ userId: true })
  .partial();

// ─── Resource Allocation ────────────────────────────────────
export const createResourceAllocationSchema = z.object({
  auditorId: z.string().uuid(),
  role: z.enum(["lead", "team_member", "specialist", "observer"]),
  plannedHours: z.number().min(0).max(10000),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

export const updateResourceAllocationSchema =
  createResourceAllocationSchema.partial();

// ─── Time Entries ───────────────────────────────────────────
export const createAuditTimeEntrySchema = z.object({
  auditId: z.string().uuid(),
  workDate: z.string().date(),
  hours: z.number().min(0.25).max(24),
  description: z.string().max(1000).optional(),
});

// ─── Continuous Audit Rules ─────────────────────────────────
export const createContinuousAuditRuleSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  ruleType: z.enum(["builtin", "custom_sql", "api_check"]),
  dataSource: z.record(z.unknown()),
  condition: z.record(z.unknown()),
  schedule: z.enum(["daily", "weekly", "monthly"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  riskArea: z.string().max(100).optional(),
});

export const updateContinuousAuditRuleSchema =
  createContinuousAuditRuleSchema.partial();

// ─── Exception Management ───────────────────────────────────
export const acknowledgeExceptionSchema = z.object({
  justification: z.string().min(1).max(5000),
});

export const falsePositiveExceptionSchema = z.object({
  justification: z.string().min(1).max(5000),
});

// ─── QA Review ──────────────────────────────────────────────
export const createQaReviewSchema = z.object({
  reviewerId: z.string().uuid(),
});

export const updateQaChecklistSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        compliance: z.enum([
          "compliant",
          "partially_compliant",
          "non_compliant",
          "not_applicable",
        ]),
        reviewerComment: z.string().max(2000).optional(),
      }),
    )
    .min(1)
    .max(25),
});

// ─── QA Score Computation ───────────────────────────────────
export function computeQaScore(
  items: Array<{ compliance: string | null; weight: number }>,
): { score: number; rating: string } {
  const applicable = items.filter(
    (i) => i.compliance !== "not_applicable" && i.compliance !== null,
  );
  if (applicable.length === 0) return { score: 0, rating: "red" };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const item of applicable) {
    const complianceScore =
      item.compliance === "compliant"
        ? 100
        : item.compliance === "partially_compliant"
          ? 50
          : 0;
    weightedSum += complianceScore * item.weight;
    totalWeight += item.weight * 100;
  }

  const score = Math.round((weightedSum / totalWeight) * 100);
  const rating = score >= 80 ? "green" : score >= 60 ? "yellow" : "red";
  return { score, rating };
}

// ─── External Auditor Share ─────────────────────────────────
export const createExternalShareSchema = z.object({
  externalUserId: z.string().uuid(),
  entityType: z.enum(["audit_report", "working_paper", "finding", "document"]),
  entityId: z.string().uuid(),
  accessLevel: z.enum(["read_only", "read_comment"]).default("read_only"),
  expiresAt: z.string().datetime(),
});

// ─── WP Reference Generator ────────────────────────────────
export function generateWpReference(
  folderCode: string,
  existingReferencesInFolder: string[],
): string {
  const escapedCode = folderCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedCode}\\.(\\d+)$`);
  let maxIndex = 0;
  for (const ref of existingReferencesInFolder) {
    const match = ref.match(pattern);
    if (match) {
      const idx = parseInt(match[1], 10);
      if (idx > maxIndex) maxIndex = idx;
    }
  }
  return `${folderCode}.${maxIndex + 1}`;
}

// ─── Custom SQL Validation ──────────────────────────────────
const WRITE_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)\b/i;

export function isReadOnlySql(query: string): boolean {
  return !WRITE_KEYWORDS.test(query);
}
