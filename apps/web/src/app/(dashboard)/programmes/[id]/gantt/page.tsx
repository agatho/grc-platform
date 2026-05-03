"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { ProgrammeGantt } from "@/components/programme/programme-gantt";
import { Loader2, ArrowLeft } from "lucide-react";

interface JourneyData {
  journey: {
    id: string;
    name: string;
    startedAt: string | null;
    targetCompletionDate: string | null;
  };
  phases: Array<{
    id: string;
    code: string;
    name: string;
    pdcaPhase: string;
    status: string;
    plannedStartDate: string | null;
    plannedEndDate: string | null;
  }>;
}

interface StepData {
  id: string;
  phaseId: string;
  code: string;
  name: string;
  status: string;
  dueDate: string | null;
  isMilestone: boolean;
  ownerId: string | null;
}

export default function ProgrammeGanttPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("programme");
  const [data, setData] = useState<JourneyData | null>(null);
  const [steps, setSteps] = useState<StepData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [dashRes, stepsRes] = await Promise.all([
          fetch(`/api/v1/programmes/journeys/${id}/dashboard`),
          fetch(`/api/v1/programmes/journeys/${id}/steps`),
        ]);
        if (!dashRes.ok) throw new Error(`HTTP ${dashRes.status}`);
        if (!stepsRes.ok) throw new Error(`HTTP ${stepsRes.status}`);
        const dashJson = await dashRes.json();
        const stepsJson = await stepsRes.json();
        // Map phase data shape
        const phases = (dashJson.data.phases ?? []).map(
          (p: {
            id: string;
            code: string;
            name: string;
            pdcaPhase: string;
            status: string;
            plannedStartDate: string | null;
            plannedEndDate: string | null;
          }) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            pdcaPhase: p.pdcaPhase,
            status: p.status,
            plannedStartDate: p.plannedStartDate,
            plannedEndDate: p.plannedEndDate,
          }),
        );
        setData({
          journey: {
            id: dashJson.data.journey.id,
            name: dashJson.data.journey.name,
            startedAt: dashJson.data.journey.startedAt,
            targetCompletionDate: dashJson.data.journey.targetCompletionDate,
          },
          phases,
        });
        setSteps(
          (stepsJson.data ?? []).map((s: StepData) => ({
            id: s.id,
            phaseId: s.phaseId,
            code: s.code,
            name: s.name,
            status: s.status,
            dueDate: s.dueDate,
            isMilestone: s.isMilestone,
            ownerId: s.ownerId,
          })),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [id]);

  if (error)
    return (
      <ModuleGate moduleKey="programme">
        <div className="p-6 text-sm text-red-700">{error}</div>
      </ModuleGate>
    );
  if (!data)
    return (
      <ModuleGate moduleKey="programme">
        <div className="flex items-center gap-2 p-6 text-slate-500">
          <Loader2 className="size-4 animate-spin" /> {t("loading")}
        </div>
      </ModuleGate>
    );

  return (
    <ModuleGate moduleKey="programme">
      <div className="space-y-4 p-6">
        <Link
          href={`/programmes/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t("step.backToCockpit")}
        </Link>

        <header>
          <h1 className="text-2xl font-semibold">
            {t("gantt.title")}: {data.journey.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("gantt.description")}</p>
        </header>

        <ProgrammeGantt
          journeyId={id}
          phases={data.phases}
          steps={steps}
          startDate={data.journey.startedAt}
          endDate={data.journey.targetCompletionDate}
        />
      </div>
    </ModuleGate>
  );
}
