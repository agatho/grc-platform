"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { ProgrammeProgressBar } from "@/components/programme/programme-progress-bar";

interface TimelineData {
  journey: {
    id: string;
    name: string;
    startedAt: string | null;
    targetCompletionDate: string | null;
    progressPercent: string;
  };
  phases: Array<{
    id: string;
    code: string;
    sequence: number;
    name: string;
    pdcaPhase: string;
    status: string;
    progressPercent: string;
    plannedStart: string | null;
    plannedEnd: string | null;
    actualStart: string | null;
    actualEnd: string | null;
  }>;
  milestones: Array<{
    id: string;
    phaseId: string;
    code: string;
    name: string;
    status: string;
    dueDate: string | null;
    completedAt: string | null;
  }>;
}

const phaseColors: Record<string, string> = {
  plan: "bg-blue-200 dark:bg-blue-900",
  do: "bg-emerald-200 dark:bg-emerald-900",
  check: "bg-amber-200 dark:bg-amber-900",
  act: "bg-violet-200 dark:bg-violet-900",
  continuous: "bg-slate-200 dark:bg-slate-800",
};

function dateToMs(d: string | null): number | null {
  if (!d) return null;
  const parsed = Date.parse(d + "T00:00:00Z");
  return isNaN(parsed) ? null : parsed;
}

export default function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("programme");
  const [data, setData] = useState<TimelineData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/v1/programmes/journeys/${id}/timeline`);
      if (r.ok) {
        const json = await r.json();
        if (!cancelled) setData(json.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!data) {
    return (
      <ModuleGate moduleKey="programme">
        <div className="flex items-center gap-2 p-6 text-slate-500">
          <Loader2 className="size-4 animate-spin" /> {t("loading")}
        </div>
      </ModuleGate>
    );
  }

  // Berechne min/max für Timeline
  const allDates = data.phases.flatMap((p) => [
    dateToMs(p.plannedStart),
    dateToMs(p.plannedEnd),
    dateToMs(p.actualStart),
    dateToMs(p.actualEnd),
  ]);
  const validDates = allDates.filter((d): d is number => d !== null);
  const minMs = validDates.length > 0 ? Math.min(...validDates) : Date.now();
  const maxMs = validDates.length > 0 ? Math.max(...validDates) : Date.now();
  const span = Math.max(1, maxMs - minMs);

  return (
    <ModuleGate moduleKey="programme">
      <div className="space-y-6 p-6">
        <Link
          href={`/programmes/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t("step.backToCockpit")}
        </Link>

        <header>
          <h1 className="text-2xl font-semibold">{data.journey.name}</h1>
          <p className="text-sm text-slate-500">
            {t("timeline.title")}
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>{t("timeline.phasesHeading")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {data.phases.map((phase) => {
                const start = dateToMs(phase.plannedStart) ?? minMs;
                const end = dateToMs(phase.plannedEnd) ?? maxMs;
                const offsetPct = ((start - minMs) / span) * 100;
                const widthPct = Math.max(2, ((end - start) / span) * 100);
                const pct =
                  parseFloat(phase.progressPercent) || 0;
                return (
                  <li key={phase.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        <span className="mr-2 font-mono uppercase text-slate-500">
                          {t(`pdcaPhase.${phase.pdcaPhase}`)}
                        </span>
                        {phase.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {phase.plannedStart} → {phase.plannedEnd}
                      </span>
                    </div>
                    <div className="relative mt-1 h-6 rounded bg-slate-100 dark:bg-slate-800">
                      <div
                        className={
                          "absolute top-0 h-6 rounded " +
                          (phaseColors[phase.pdcaPhase] ?? "bg-slate-300")
                        }
                        style={{
                          left: `${offsetPct}%`,
                          width: `${widthPct}%`,
                        }}
                      />
                      <div
                        className="absolute top-0 h-6 rounded bg-emerald-500/40"
                        style={{
                          left: `${offsetPct}%`,
                          width: `${(widthPct * pct) / 100}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("timeline.milestonesHeading")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.milestones.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("timeline.noMilestones")}
              </p>
            ) : (
              <ul className="space-y-2">
                {data.milestones.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded border border-slate-200 p-2 text-sm dark:border-slate-700"
                  >
                    <span>
                      <span className="mr-2 inline-block rounded bg-amber-200 px-1 text-xs font-semibold text-amber-900">
                        ★
                      </span>
                      {m.name}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      {m.completedAt ? `✓ ${m.completedAt}` : (m.dueDate ?? "—")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("timeline.overallProgress")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ProgrammeProgressBar
                percent={parseFloat(data.journey.progressPercent)}
              />
              <span className="font-mono text-sm">
                {Math.round(parseFloat(data.journey.progressPercent))}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleGate>
  );
}
