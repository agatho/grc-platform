"use client";

import { useTranslations } from "next-intl";

interface Props {
  percent: number;
  className?: string;
  /**
   * Accessible name. Without one the control is announced as
   * "progress bar, 42 percent" with no indication of what is progressing.
   */
  label?: string;
}

/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-12] Two axe violations lived here, and
 * both fired unconditionally — no prop combination avoided them:
 *
 *   aria-progressbar-name (serious) — `role="progressbar"` with neither
 *     `aria-label` nor `aria-labelledby` (WCAG 4.1.2).
 *   aria-valid-attr-value (critical) — `Math.max(0, Math.min(100, percent))`
 *     evaluates to `NaN` when `percent` is `undefined`, and React then wrote
 *     `aria-valuenow="NaN"` into the DOM.
 *
 * The NaN case is fixed by expressing "unknown" the way ARIA expects it: an
 * indeterminate progress bar OMITS `aria-valuenow`. Clamping to 0 would have
 * silenced axe while announcing "0 % complete" — a different, and false,
 * statement.
 */
export function ProgrammeProgressBar({ percent, className, label }: Props) {
  const t = useTranslations("programme");
  const known = typeof percent === "number" && Number.isFinite(percent);
  const pct = known ? Math.max(0, Math.min(100, percent)) : 0;
  return (
    <div
      className={
        "h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 " +
        (className ?? "")
      }
      role="progressbar"
      aria-label={label ?? t("progress.label")}
      aria-valuemin={0}
      aria-valuemax={100}
      // Omitted entirely when the value is unknown — that is what makes a
      // progress bar indeterminate, and it is not the same as 0 %.
      aria-valuenow={known ? pct : undefined}
      aria-valuetext={
        known ? t("progress.percent", { percent: pct }) : t("progress.unknown")
      }
    >
      <div
        className="h-2 rounded-full bg-emerald-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
