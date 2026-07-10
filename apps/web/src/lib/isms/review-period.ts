// Zeitraum-Logik für das Management-Review-Cockpit (ISO 27001 9.3).
//
// Der Aggregations-Zeitraum für die 9.3.2-Inputs wird in dieser
// Priorität aufgelöst:
//   1. Query-Override (?from=YYYY-MM-DD&to=YYYY-MM-DD)
//   2. Am Review gepflegter Zeitraum (period_start / period_end)
//   3. Seit dem letzten abgeschlossenen Review (dessen review_date)
//   4. Fallback: 12 Monate vor dem Review-Datum
//
// Reine Funktion — keine DB-Zugriffe, damit sie unit-testbar bleibt.

export interface ReviewPeriodSource {
  /** review_date des Reviews (YYYY-MM-DD) */
  reviewDate: string;
  /** optional am Review gepflegter Zeitraum */
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface ResolvedReviewPeriod {
  from: Date;
  to: Date;
  source: "override" | "review_period" | "last_completed" | "fallback_12m";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a strict YYYY-MM-DD string to a UTC-midnight Date, or null. */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveReviewPeriod(options: {
  review: ReviewPeriodSource;
  /** review_date des letzten completed Reviews vor diesem (oder null) */
  lastCompletedReviewDate: string | null;
  /** Query-Overrides (bereits als YYYY-MM-DD validierbar, sonst ignoriert) */
  overrideFrom?: string | null;
  overrideTo?: string | null;
}): ResolvedReviewPeriod {
  const { review, lastCompletedReviewDate, overrideFrom, overrideTo } = options;

  const reviewDate =
    parseIsoDate(review.reviewDate) ?? new Date(new Date().toDateString());

  // Ende des Zeitraums: Override > period_end > review_date
  const toOverride = parseIsoDate(overrideTo);
  const toPeriod = parseIsoDate(review.periodEnd);
  const to = toOverride ?? toPeriod ?? reviewDate;

  // 1. Override
  const fromOverride = parseIsoDate(overrideFrom);
  if (fromOverride) {
    return { from: fromOverride, to, source: "override" };
  }

  // 2. Am Review gepflegter Zeitraum
  const fromPeriod = parseIsoDate(review.periodStart);
  if (fromPeriod) {
    return { from: fromPeriod, to, source: "review_period" };
  }

  // 3. Seit letztem completed Review
  const fromLast = parseIsoDate(lastCompletedReviewDate);
  if (fromLast) {
    return { from: fromLast, to, source: "last_completed" };
  }

  // 4. Fallback: 12 Monate vor dem Review-Datum
  const fallback = new Date(to);
  fallback.setUTCFullYear(fallback.getUTCFullYear() - 1);
  return { from: fallback, to, source: "fallback_12m" };
}
