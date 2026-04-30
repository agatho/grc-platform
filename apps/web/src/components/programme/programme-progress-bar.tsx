"use client";

interface Props {
  percent: number;
  className?: string;
}

export function ProgrammeProgressBar({ percent, className }: Props) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={
        "h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 " +
        (className ?? "")
      }
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div
        className="h-2 rounded-full bg-emerald-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
