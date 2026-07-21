// Pure UI helpers for the Risk-Acceptance review cockpit and the
// risk-detail acceptance panel (ISO 27005 Clause 10).
//
// Kept free of React so the filter / expiry-highlight / error-mapping
// logic is unit-testable in node — see
// src/__tests__/lib/risk-acceptance-ui.test.ts.

import type { RiskAcceptanceStatus } from "@grc/shared";

/** "Expiring soon" threshold used by the cockpit highlight + filter. */
export const ACCEPTANCE_EXPIRY_WARNING_DAYS = 30;

const MS_PER_DAY = 86_400_000;

// ─── Expiry ──────────────────────────────────────────────────────────

export type AcceptanceExpiryState = "none" | "expired" | "expiringSoon" | "ok";

/**
 * Whole days from "today" (derived from `now`) until a YYYY-MM-DD date.
 * Returns null when the date is missing or unparseable.
 * 0 = expires today, negative = already past.
 */
export function daysUntil(
  dateStr: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!dateStr) return null;
  const target = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

/**
 * Classify a `validUntil` date for highlighting. Callers should only
 * apply the warning styles to acceptances with status "active" — for
 * expired/revoked rows the date is historical context.
 */
export function acceptanceExpiryState(
  validUntil: string | null | undefined,
  now: Date = new Date(),
  warningDays: number = ACCEPTANCE_EXPIRY_WARNING_DAYS,
): AcceptanceExpiryState {
  const days = daysUntil(validUntil, now);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= warningDays) return "expiringSoon";
  return "ok";
}

// ─── Text ────────────────────────────────────────────────────────────

/** Truncate for table cells; appends an ellipsis when cut. */
export function truncateText(
  text: string | null | undefined,
  max = 80,
): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

// ─── List query ──────────────────────────────────────────────────────

/** Local-date ISO string (YYYY-MM-DD) `days` days from `now`. */
export function isoDateInDays(days: number, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface AcceptanceListQueryOptions {
  page: number;
  limit: number;
  /** Omit or pass "all" for no status filter. */
  status?: RiskAcceptanceStatus | "all";
  /** Restrict to acceptances expiring within the warning window. */
  expiringOnly?: boolean;
  riskId?: string;
  sort?: "acceptedAt" | "validUntil" | "status";
  sortDir?: "asc" | "desc";
  /** Injectable clock for tests. */
  now?: Date;
}

/**
 * Build the query string for GET /api/v1/risk-acceptances. Only emits
 * params the route's strict allow-list accepts (status, riskId,
 * expiringBefore, sort, sortDir + page/limit).
 */
export function buildAcceptanceListQuery(
  opts: AcceptanceListQueryOptions,
): string {
  const params = new URLSearchParams();
  params.set("page", String(opts.page));
  params.set("limit", String(opts.limit));
  // Expiring-soon review reads best in ascending expiry order.
  params.set(
    "sort",
    opts.sort ?? (opts.expiringOnly ? "validUntil" : "acceptedAt"),
  );
  params.set("sortDir", opts.sortDir ?? (opts.expiringOnly ? "asc" : "desc"));
  if (opts.status && opts.status !== "all") {
    params.set("status", opts.status);
  }
  if (opts.riskId) {
    params.set("riskId", opts.riskId);
  }
  if (opts.expiringOnly) {
    params.set(
      "expiringBefore",
      isoDateInDays(ACCEPTANCE_EXPIRY_WARNING_DAYS, opts.now),
    );
  }
  return params.toString();
}

// ─── Server-error mapping (accept flow) ──────────────────────────────
//
// POST /api/v1/risks/:id/acceptance answers with domain-specific errors
// (four-eyes 422, authority-band 403, already-accepted 409, unscored
// 422). Map them onto stable i18n keys under `risk.acceptance.errors`.

export type AcceptanceApiErrorKey =
  | "fourEyes"
  | "insufficientAuthority"
  | "alreadyAccepted"
  | "notScored"
  | "validation"
  | "generic";

export interface AcceptanceApiErrorInfo {
  key: AcceptanceApiErrorKey;
  /** Interpolation params for the i18n message. */
  params?: Record<string, string | number>;
  /** Raw server message as fallback / detail. */
  serverMessage?: string;
}

export function mapAcceptanceApiError(
  status: number,
  body: unknown,
): AcceptanceApiErrorInfo {
  const rec =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const message = typeof rec.error === "string" ? rec.error : undefined;

  if (status === 403 && typeof rec.requiredRole === "string") {
    return {
      key: "insufficientAuthority",
      params: {
        requiredRole: rec.requiredRole,
        score: typeof rec.score === "number" ? rec.score : 0,
      },
      serverMessage: typeof rec.detail === "string" ? rec.detail : message,
    };
  }
  if (status === 409) {
    return { key: "alreadyAccepted", serverMessage: message };
  }
  if (status === 422 && message) {
    if (message.includes("Four-eyes")) {
      return { key: "fourEyes", serverMessage: message };
    }
    if (message.includes("unscored")) {
      return { key: "notScored", serverMessage: message };
    }
    if (message === "Validation failed") {
      return { key: "validation", serverMessage: message };
    }
  }
  return { key: "generic", serverMessage: message };
}
