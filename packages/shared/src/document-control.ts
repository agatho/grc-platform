// DMS Document Control — pure helpers for versioning (major/minor +
// effective dating), point-in-time resolution, four-eyes enforcement,
// review-reminder staging and retention-purge eligibility.
//
// Lives in @grc/shared because both apps/web (API routes) and
// apps/worker (crons) consume the same logic; keeping it pure makes
// it unit-testable without a DB (see
// apps/web/src/__tests__/lib/document-control.test.ts).

// ─── Major/Minor versioning ──────────────────────────────────

export type DocumentVersionBump = "major" | "minor";

export interface DocumentVersionNumbers {
  versionNumber: number;
  versionMajor: number;
  versionMinor: number;
  versionLabel: string;
}

export function formatVersionLabel(major: number, minor: number): string {
  return `${major}.${minor}`;
}

/**
 * Compute the next version numbers from the current version.
 * - minor bump: content edit in draft (2.1 → 2.2)
 * - major bump: publish transition (2.2 → 3.0)
 *
 * Legacy versions created before the effective-dating migration only
 * carry an integer `versionNumber`; for those the migration backfilled
 * major = versionNumber, minor = 0 — the fallbacks here mirror that so
 * the helper stays correct even against un-backfilled rows.
 */
export function computeNextVersion(
  current: {
    versionNumber: number;
    versionMajor?: number | null;
    versionMinor?: number | null;
  },
  bump: DocumentVersionBump,
): DocumentVersionNumbers {
  const major = current.versionMajor ?? current.versionNumber;
  const minor = current.versionMinor ?? 0;
  const versionMajor = bump === "major" ? major + 1 : major;
  const versionMinor = bump === "major" ? 0 : minor + 1;
  return {
    versionNumber: current.versionNumber + 1,
    versionMajor,
    versionMinor,
    versionLabel: formatVersionLabel(versionMajor, versionMinor),
  };
}

// ─── Point-in-time resolution (effective dating) ─────────────

export interface EffectiveDatedVersion {
  validFrom: Date | string | null;
  validUntil: Date | string | null;
  createdAt: Date | string;
}

function toTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Resolve which version was effective at a given point in time.
 *
 * Primary rule: validFrom <= at < validUntil (validUntil NULL = open
 * window). Fallback for legacy rows without validFrom: treat createdAt
 * as the start of the window and pick the latest version created at or
 * before `at`.
 */
export function resolveVersionAt<T extends EffectiveDatedVersion>(
  versions: T[],
  at: Date,
): T | null {
  const ts = at.getTime();

  const windowed = versions.filter((v) => v.validFrom != null);
  // Latest matching window wins if backfill produced overlaps.
  const hits = windowed
    .filter(
      (v) =>
        toTime(v.validFrom!) <= ts &&
        (v.validUntil == null || ts < toTime(v.validUntil)),
    )
    .sort((a, b) => toTime(a.validFrom!) - toTime(b.validFrom!));
  if (hits.length > 0) return hits[hits.length - 1];

  // Fallback: createdAt window
  const sorted = [...versions].sort(
    (a, b) => toTime(a.createdAt) - toTime(b.createdAt),
  );
  let candidate: T | null = null;
  for (const v of sorted) {
    if (toTime(v.createdAt) <= ts) candidate = v;
  }
  return candidate;
}

// ─── Four-eyes principle (segregation of duties) ─────────────

export interface FourEyesCheckInput {
  currentStatus: string;
  targetStatus: string;
  actorId: string;
  /** createdBy of the current document_version (last content editor) */
  currentVersionCreatedBy?: string | null;
  documentCreatedBy?: string | null;
  documentUpdatedBy?: string | null;
}

export interface FourEyesCheckResult {
  violation: boolean;
  /** Which transition was guarded (for error messages) */
  guardedTransition?: "approve" | "publish";
}

/**
 * Server-side four-eyes enforcement: the transitions
 * in_review → approved and approved → published must not be performed
 * by the creator / last content editor of the current version.
 */
export function checkFourEyes(input: FourEyesCheckInput): FourEyesCheckResult {
  const isApprove =
    input.currentStatus === "in_review" && input.targetStatus === "approved";
  const isPublish =
    input.currentStatus === "approved" && input.targetStatus === "published";
  if (!isApprove && !isPublish) return { violation: false };

  const lastContentEditor =
    input.currentVersionCreatedBy ??
    input.documentUpdatedBy ??
    input.documentCreatedBy ??
    null;

  if (lastContentEditor !== null && lastContentEditor === input.actorId) {
    return {
      violation: true,
      guardedTransition: isApprove ? "approve" : "publish",
    };
  }
  return { violation: false };
}

// ─── Review reminder staging (30/14/7/0 days) ────────────────

export const DOCUMENT_REVIEW_REMINDER_STAGES = [30, 14, 7, 0] as const;

/**
 * Map "days until review" to the reminder stage the document is
 * currently in. Returns null when the review is more than 30 days out
 * (no reminder yet). daysUntil <= 0 → stage 0 (due/overdue).
 */
export function reviewReminderStage(daysUntilReview: number): number | null {
  if (daysUntilReview > 30) return null;
  if (daysUntilReview > 14) return 30;
  if (daysUntilReview > 7) return 14;
  if (daysUntilReview > 0) return 7;
  return 0;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Decide whether a staged review reminder should be sent now.
 * A reminder fires once per stage: when no reminder was ever sent, or
 * when the document has moved into a closer stage since the last one.
 */
export function shouldSendReviewReminder(input: {
  reviewDate: Date;
  lastReminderSentAt: Date | null;
  now: Date;
}): boolean {
  const stageNow = reviewReminderStage(daysBetween(input.now, input.reviewDate));
  if (stageNow === null) return false;
  if (input.lastReminderSentAt === null) return true;
  const stageAtLast = reviewReminderStage(
    daysBetween(input.lastReminderSentAt, input.reviewDate),
  );
  if (stageAtLast === null) return true;
  return stageNow < stageAtLast;
}

// ─── Signature due-date reminders (3/0 days) + escalation ────
// W21-DMS-MULTISIGN-02: staged reminders for pending signature
// requests, same once-per-stage mechanic as the review reminders
// above, but with a tighter 3-day window; plus a one-time overdue
// escalation (> 3 days past due) to creator + document owner.

export const SIGNATURE_DUE_REMINDER_STAGES = [3, 0] as const;

/**
 * Map "days until signature due date" to the reminder stage. Returns
 * null when the due date is more than 3 days out (no reminder yet).
 * daysUntil <= 0 → stage 0 (due/overdue).
 */
export function signatureDueReminderStage(daysUntilDue: number): number | null {
  if (daysUntilDue > 3) return null;
  if (daysUntilDue > 0) return 3;
  return 0;
}

/**
 * Decide whether a staged signature due-date reminder should be sent
 * now. Fires once per stage: when no reminder was ever sent, or when
 * the request has moved into a closer stage since the last one
 * (pattern: shouldSendReviewReminder).
 */
export function shouldSendSignatureDueReminder(input: {
  dueDate: Date;
  lastReminderSentAt: Date | null;
  now: Date;
}): boolean {
  const stageNow = signatureDueReminderStage(
    daysBetween(input.now, input.dueDate),
  );
  if (stageNow === null) return false;
  if (input.lastReminderSentAt === null) return true;
  const stageAtLast = signatureDueReminderStage(
    daysBetween(input.lastReminderSentAt, input.dueDate),
  );
  if (stageAtLast === null) return true;
  return stageNow < stageAtLast;
}

/** Grace period after the due date before the one-time escalation. */
export const SIGNATURE_ESCALATION_GRACE_MS = 3 * 86_400_000;

/**
 * One-time overdue escalation: fires when the request is overdue by
 * more than 3 full days AND has not been escalated yet (escalated_at,
 * migration 0376). Deliberately no auto-cancel — the request creator
 * decides (cancel route).
 */
export function shouldEscalateSignatureRequest(input: {
  dueDate: Date;
  escalatedAt: Date | null;
  now: Date;
}): boolean {
  if (input.escalatedAt !== null) return false;
  return (
    input.now.getTime() - input.dueDate.getTime() >
    SIGNATURE_ESCALATION_GRACE_MS
  );
}

// ─── Retention ───────────────────────────────────────────────

export type RetentionBasis = "created" | "published" | "expired";

/**
 * Compute the retention deadline for a document from an assigned
 * policy. Returns null when the basis date is not (yet) available —
 * e.g. basis 'published' on a never-published document.
 */
export function computeRetentionUntil(input: {
  basis: RetentionBasis;
  retentionYears: number;
  createdAt: Date | string | null;
  publishedAt?: Date | string | null;
  expiresAt?: Date | string | null;
}): Date | null {
  const baseRaw =
    input.basis === "created"
      ? input.createdAt
      : input.basis === "published"
        ? (input.publishedAt ?? null)
        : (input.expiresAt ?? null);
  if (baseRaw == null) return null;
  const base = baseRaw instanceof Date ? new Date(baseRaw) : new Date(baseRaw);
  if (Number.isNaN(base.getTime())) return null;
  const until = new Date(base);
  until.setFullYear(until.getFullYear() + input.retentionYears);
  return until;
}

export interface RetentionPurgeCandidate {
  retentionUntil: Date | string | null;
  legalHold: boolean;
  status: string;
}

/**
 * Purge selection rule for the document-retention-purge cron:
 * retention deadline passed AND no legal hold AND terminal lifecycle
 * status (archived/expired). Active or draft documents are never
 * purged even when a stale retention date exists.
 */
export function isRetentionPurgeEligible(
  doc: RetentionPurgeCandidate,
  now: Date,
): boolean {
  if (doc.legalHold) return false;
  if (doc.retentionUntil == null) return false;
  const until =
    doc.retentionUntil instanceof Date
      ? doc.retentionUntil
      : new Date(doc.retentionUntil);
  if (Number.isNaN(until.getTime())) return false;
  if (until.getTime() >= now.getTime()) return false;
  return doc.status === "archived" || doc.status === "expired";
}
