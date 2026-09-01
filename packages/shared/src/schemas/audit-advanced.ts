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
//
// #S04-01 (audit ARCTOS-FULL-2026-08-31, Critical): the previous
// implementation was a pure keyword BLOCKLIST
//
//   const WRITE_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE)\b/i;
//   isReadOnlySql = (q) => !WRITE_KEYWORDS.test(q);
//
// applied ONLY at rule-creation time. It was empirically bypassed by
// every one of the following (evidence/S04/isreadonlysql-bypass.txt):
//
//   SELECT * INTO evil FROM organization        -- DDL+DML, no keyword
//   SELECT 1; DO $$ BEGIN EXECUTE 'CRE'||'ATE …' -- string-split DDL
//   SELECT 1; COPY t FROM PROGRAM 'id'          -- RCE as superuser
//   SELECT 1; GRANT ALL … TO PUBLIC             -- privilege escalation
//   SELECT pg_sleep(3600)                       -- DoS
//
// and the worker executed the result as the DB SUPERUSER `grc`
// (BYPASSRLS) via sql.raw(`SET LOCAL statement_timeout=…; ${query}`),
// i.e. multi-statement.
//
// The blocklist is replaced by a strict ALLOWLIST that mirrors the
// hardened sister endpoint `bi-reports/queries/execute`: a single
// SELECT statement, no semicolons, no comments, no dollar-quoting, no
// data-modifying CTEs, no server-side file/program/sleep functions.
// This is only the FIRST of two layers — the worker re-validates with
// the same function at execution time and additionally runs the query
// inside a transaction with `SET LOCAL ROLE grc_app` +
// `SET TRANSACTION READ ONLY` (see
// apps/worker/src/crons/continuous-audit-runner.ts). Neither layer is
// allowed to be the only one.

/** Hard cap so a rule cannot smuggle a novel through the parser. */
export const CUSTOM_SQL_MAX_LENGTH = 8000;

/**
 * Statement keywords that must never appear anywhere in a custom rule.
 * Matched as whole words, case-insensitively, on the *whole* string —
 * we do not attempt to tokenize SQL, so anything resembling one of
 * these is refused outright. False positives (a column literally named
 * "update") are acceptable for an admin-authored audit query.
 */
const FORBIDDEN_TOKENS =
  /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|DO|CALL|VACUUM|ANALYZE|CLUSTER|REINDEX|REFRESH|LOCK|SET|RESET|BEGIN|START|COMMIT|ROLLBACK|SAVEPOINT|PREPARE|EXECUTE|DEALLOCATE|DECLARE|FETCH|MOVE|CLOSE|LISTEN|NOTIFY|UNLISTEN|IMPORT|SECURITY|COMMENT|EXPLAIN|SHOW|INTO|PROGRAM)\b/i;

/**
 * Functions that read/write the server's filesystem, spawn programs,
 * open outbound connections or block the backend. None of these are
 * legitimate in a continuous-audit rule.
 */
const FORBIDDEN_FUNCTIONS =
  /\b(pg_sleep|pg_sleep_for|pg_sleep_until|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|pg_logdir_ls|lo_import|lo_export|dblink|dblink_connect|dblink_exec|postgres_fdw_handler|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_rotate_logfile|set_config|current_setting|pg_advisory_lock|pg_advisory_xact_lock)\s*\(/i;

export interface CustomSqlValidation {
  ok: boolean;
  /** Normalized (trimmed) statement — only set when ok. */
  sql?: string;
  /** Operator-facing reason — only set when !ok. */
  reason?: string;
}

/**
 * Allowlist validator for continuous-audit `custom_sql` rules.
 *
 * Used at BOTH rule-creation time (API) and rule-execution time
 * (worker). Returns a structured result so the worker can log *why* a
 * stored rule was refused.
 */
export function validateCustomAuditSql(query: unknown): CustomSqlValidation {
  if (typeof query !== "string") {
    return { ok: false, reason: "Custom SQL must be a string." };
  }

  const trimmed = query.trim();

  if (trimmed.length === 0) {
    return { ok: false, reason: "Custom SQL must not be empty." };
  }
  if (trimmed.length > CUSTOM_SQL_MAX_LENGTH) {
    return {
      ok: false,
      reason: `Custom SQL exceeds the maximum length of ${CUSTOM_SQL_MAX_LENGTH} characters.`,
    };
  }

  // No NUL / control characters that could confuse the wire protocol or
  // hide payload from a reviewer reading the rule in the UI.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(trimmed)) {
    return { ok: false, reason: "Custom SQL contains control characters." };
  }

  // Single statement only. Any semicolon — including a trailing one —
  // is refused; a trailing semicolon is indistinguishable from the
  // start of a second statement once the string is concatenated.
  if (trimmed.includes(";")) {
    return {
      ok: false,
      reason: "Custom SQL must be a single statement (no ';' allowed).",
    };
  }

  // Comments can hide payload from human review and from naive scanners.
  if (
    trimmed.includes("--") ||
    trimmed.includes("/*") ||
    trimmed.includes("*/")
  ) {
    return { ok: false, reason: "SQL comments are not allowed." };
  }

  // Dollar-quoting is the standard vehicle for DO/function bodies.
  if (trimmed.includes("$$") || /\$[A-Za-z_][A-Za-z0-9_]*\$/.test(trimmed)) {
    return { ok: false, reason: "Dollar-quoted strings are not allowed." };
  }

  // Must be a plain SELECT. `WITH` is deliberately NOT allowed because a
  // data-modifying CTE (`WITH x AS (INSERT … RETURNING …) SELECT …`) is
  // a write disguised as a SELECT.
  if (!/^SELECT\b/i.test(trimmed)) {
    return {
      ok: false,
      reason: "Custom SQL must be a single SELECT statement.",
    };
  }

  const forbidden = trimmed.match(FORBIDDEN_TOKENS);
  if (forbidden) {
    return {
      ok: false,
      reason: `Keyword '${forbidden[1].toUpperCase()}' is not allowed in custom audit SQL.`,
    };
  }

  const forbiddenFn = trimmed.match(FORBIDDEN_FUNCTIONS);
  if (forbiddenFn) {
    return {
      ok: false,
      reason: `Function '${forbiddenFn[1]}' is not allowed in custom audit SQL.`,
    };
  }

  return { ok: true, sql: trimmed };
}

/**
 * Backwards-compatible boolean wrapper.
 *
 * Kept so the creation route
 * (`apps/web/src/app/api/v1/audit-mgmt/continuous-rules/route.ts`,
 * owned by another work package) picks up the strict semantics without
 * a signature change. New call sites should prefer
 * {@link validateCustomAuditSql} so they can surface the reason.
 */
export function isReadOnlySql(query: string): boolean {
  return validateCustomAuditSql(query).ok;
}
