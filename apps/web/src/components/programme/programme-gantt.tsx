"use client";

// Read-only Gantt chart für eine Programme-Journey.
// Zero dependencies — pure SVG + CSS.
// Renderbar bei beliebiger Step-Anzahl (vertikal scrollbar bei > 30 Steps).

import { useMemo } from "react";
import Link from "next/link";

interface GanttPhase {
  id: string;
  code: string;
  name: string;
  pdcaPhase: string;
  status: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
}

interface GanttStep {
  id: string;
  phaseId: string;
  code: string;
  name: string;
  status: string;
  dueDate: string | null;
  isMilestone: boolean;
  ownerId: string | null;
}

interface Props {
  journeyId: string;
  phases: GanttPhase[];
  steps: GanttStep[];
  startDate: string | null;
  endDate: string | null;
}

const PHASE_COLORS: Record<string, string> = {
  plan: "#3b82f6",
  do: "#10b981",
  check: "#f59e0b",
  act: "#8b5cf6",
  continuous: "#64748b",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#94a3b8",
  in_progress: "#3b82f6",
  blocked: "#ef4444",
  review: "#f59e0b",
  completed: "#10b981",
  skipped: "#64748b",
  cancelled: "#a3a3a3",
};

function dayDiff(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return Math.floor(
    (new Date(b + "T00:00:00Z").getTime() -
      new Date(a + "T00:00:00Z").getTime()) /
      86_400_000,
  );
}

export function ProgrammeGantt({
  journeyId,
  phases,
  steps,
  startDate,
  endDate,
}: Props) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    const allDates: string[] = [];
    if (startDate) allDates.push(startDate);
    if (endDate) allDates.push(endDate);
    for (const p of phases) {
      if (p.plannedStartDate) allDates.push(p.plannedStartDate);
      if (p.plannedEndDate) allDates.push(p.plannedEndDate);
    }
    for (const s of steps) {
      if (s.dueDate) allDates.push(s.dueDate);
    }
    allDates.sort();
    const rs = allDates[0] ?? todayStr;
    const re = allDates[allDates.length - 1] ?? todayStr;
    return {
      rangeStart: rs,
      rangeEnd: re,
      totalDays: Math.max(dayDiff(rs, re), 1),
    };
  }, [phases, steps, startDate, endDate, todayStr]);

  const xPct = (date: string | null): number => {
    if (!date) return 0;
    const d = dayDiff(rangeStart, date);
    return Math.max(0, Math.min(100, (d / totalDays) * 100));
  };

  // Group steps by phase (preserve order)
  const stepsByPhase = phases.map((p) => ({
    phase: p,
    steps: steps.filter((s) => s.phaseId === p.id),
  }));

  // Generate month tick marks
  const ticks = useMemo(() => {
    const result: Array<{ pct: number; label: string }> = [];
    const start = new Date(rangeStart + "T00:00:00Z");
    const end = new Date(rangeEnd + "T00:00:00Z");
    let cursor = new Date(start);
    cursor.setUTCDate(1);
    while (cursor <= end) {
      const iso = cursor.toISOString().slice(0, 10);
      result.push({
        pct: xPct(iso),
        label: cursor.toLocaleDateString("de-DE", {
          month: "short",
          year: "2-digit",
        }),
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return result;
  }, [rangeStart, rangeEnd]);

  const todayPct = xPct(todayStr);

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800">
      {/* Header with month ticks */}
      <div className="relative h-8 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
        <div className="absolute left-[18rem] right-0 h-full">
          {ticks.map((t, i) => (
            <div
              key={i}
              className="absolute top-1 text-xs text-slate-500"
              style={{ left: `${t.pct}%` }}
            >
              <div className="absolute -top-1 h-2 w-px bg-slate-300 dark:bg-slate-700"></div>
              <span className="ml-1">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Phase rows + step rows */}
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {stepsByPhase.map(({ phase, steps: phaseSteps }) => (
          <div key={phase.id}>
            {/* Phase header row */}
            <div className="relative flex items-center bg-slate-100/50 dark:bg-slate-800/50">
              <div className="w-72 shrink-0 px-3 py-2 text-sm font-semibold">
                <span
                  className="mr-2 inline-block size-2 rounded-full"
                  style={{
                    backgroundColor:
                      PHASE_COLORS[phase.pdcaPhase] ?? "#64748b",
                  }}
                />
                {phase.name}
              </div>
              <div className="relative h-9 flex-1 border-l border-slate-200 dark:border-slate-700">
                {/* Today line */}
                {todayPct > 0 && todayPct < 100 && (
                  <div
                    className="absolute top-0 z-10 h-full w-px bg-red-500"
                    style={{ left: `${todayPct}%` }}
                  />
                )}
                {/* Phase bar */}
                {phase.plannedStartDate && phase.plannedEndDate && (
                  <div
                    className="absolute top-2 h-5 rounded opacity-30"
                    style={{
                      left: `${xPct(phase.plannedStartDate)}%`,
                      width: `${
                        xPct(phase.plannedEndDate) -
                        xPct(phase.plannedStartDate)
                      }%`,
                      backgroundColor:
                        PHASE_COLORS[phase.pdcaPhase] ?? "#64748b",
                    }}
                  />
                )}
              </div>
            </div>
            {/* Step rows */}
            {phaseSteps.map((s) => (
              <div
                key={s.id}
                className="relative flex items-center hover:bg-slate-50 dark:hover:bg-slate-900/50"
              >
                <div className="w-72 shrink-0 px-3 py-1.5 text-xs">
                  <Link
                    href={`/programmes/${journeyId}/steps/${s.id}`}
                    className="truncate hover:underline"
                    title={s.name}
                  >
                    {s.isMilestone && <span className="mr-1">★</span>}
                    <span className="font-mono text-slate-500">{s.code}</span>{" "}
                    {s.name.length > 32
                      ? s.name.slice(0, 30) + "…"
                      : s.name}
                  </Link>
                </div>
                <div className="relative h-7 flex-1 border-l border-slate-200 dark:border-slate-700">
                  {todayPct > 0 && todayPct < 100 && (
                    <div
                      className="absolute top-0 z-10 h-full w-px bg-red-500/50"
                      style={{ left: `${todayPct}%` }}
                    />
                  )}
                  {s.dueDate && (
                    <Link
                      href={`/programmes/${journeyId}/steps/${s.id}`}
                      className="absolute top-1 flex h-5 items-center rounded px-1 text-xs text-white hover:opacity-80"
                      style={{
                        left: `${Math.max(0, xPct(s.dueDate) - 4)}%`,
                        width: s.isMilestone ? "1rem" : "4rem",
                        backgroundColor:
                          STATUS_COLORS[s.status] ?? "#94a3b8",
                      }}
                      title={`${s.code} fällig: ${s.dueDate}`}
                    >
                      {s.isMilestone ? "★" : ""}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <span className="font-semibold">Status:</span>
        {Object.entries(STATUS_COLORS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span
              className="inline-block size-3 rounded"
              style={{ backgroundColor: v }}
            />
            {k}
          </span>
        ))}
        <span className="ml-3">★ Meilenstein</span>
        <span className="ml-3 text-red-500">| Heute</span>
      </div>
    </div>
  );
}
