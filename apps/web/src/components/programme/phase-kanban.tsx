"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ProgrammeStepStatusBadge } from "./programme-status-badge";
import { ProgrammeProgressBar } from "./programme-progress-bar";

export interface KanbanPhase {
  id: string;
  code: string;
  name: string;
  status: string;
  progressPercent: string | number;
  pdcaPhase: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
}

export interface KanbanStep {
  id: string;
  code: string;
  name: string;
  phaseId: string;
  status: string;
  ownerId: string | null;
  dueDate: string | null;
  isMilestone: boolean;
  isoClause: string | null;
}

interface Props {
  journeyId: string;
  phases: KanbanPhase[];
  steps: KanbanStep[];
}

export function PhaseKanban({ journeyId, phases, steps }: Props) {
  const t = useTranslations("programme");

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {phases.map((phase) => {
        const phaseSteps = steps.filter((s) => s.phaseId === phase.id);
        const pct =
          typeof phase.progressPercent === "string"
            ? parseFloat(phase.progressPercent)
            : phase.progressPercent;
        return (
          <div
            key={phase.id}
            className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
          >
            <header className="border-b border-slate-200 p-3 dark:border-slate-800">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {t(`pdcaPhase.${phase.pdcaPhase}`)}
              </div>
              <div className="mt-1 font-semibold">{phase.name}</div>
              <div className="mt-2 flex items-center gap-2">
                <ProgrammeProgressBar percent={pct} />
                <span className="font-mono text-xs text-slate-500">
                  {Math.round(pct)}%
                </span>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-2 p-3">
              {phaseSteps.length === 0 && (
                <p className="text-sm text-slate-400">
                  {t("kanban.emptyPhase")}
                </p>
              )}
              {phaseSteps.map((step) => (
                <Link
                  key={step.id}
                  href={`/programmes/${journeyId}/steps/${step.id}`}
                  className="rounded-md border border-slate-200 bg-white p-2 transition hover:shadow dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-tight">
                      {step.isMilestone && (
                        <span
                          className="mr-1 inline-block rounded bg-amber-200 px-1 text-xs font-semibold text-amber-900"
                          aria-label="milestone"
                        >
                          ★
                        </span>
                      )}
                      {step.name}
                    </span>
                    <ProgrammeStepStatusBadge status={step.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono">{step.code}</span>
                    {step.isoClause && (
                      <span className="font-mono text-blue-600">
                        {step.isoClause}
                      </span>
                    )}
                    {step.dueDate && (
                      <span className="ml-auto">{step.dueDate}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
