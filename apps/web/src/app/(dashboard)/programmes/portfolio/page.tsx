"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Star,
  Layers,
} from "lucide-react";
import { ProgrammeStatusBadge } from "@/components/programme/programme-status-badge";
import { ProgrammeProgressBar } from "@/components/programme/programme-progress-bar";

interface PortfolioItem {
  id: string;
  name: string;
  msType: string;
  templateCode: string;
  templateVersion: string;
  status: string;
  progressPercent: number;
  startedAt: string | null;
  targetCompletionDate: string | null;
  steps: {
    total: number;
    completed: number;
    blocked: number;
    overdue: number;
    milestoneIn30d: number;
  };
  subtasks: { total: number; completed: number };
}

interface PortfolioData {
  journeyCount: number;
  totals: {
    totalSteps: number;
    completedSteps: number;
    blockedSteps: number;
    overdueSteps: number;
    milestonesNext30d: number;
    totalSubtasks: number;
    completedSubtasks: number;
  };
  journeys: PortfolioItem[];
}

export default function PortfolioPage() {
  const t = useTranslations("programme");
  const [data, setData] = useState<PortfolioData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msTypeFilter, setMsTypeFilter] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/v1/programmes/portfolio");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setData(j.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

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

  const filtered = msTypeFilter
    ? data.journeys.filter((j) => j.msType === msTypeFilter)
    : data.journeys;
  const msTypes = Array.from(new Set(data.journeys.map((j) => j.msType)));

  return (
    <ModuleGate moduleKey="programme">
      <div className="space-y-6 p-6">
        <Link
          href="/programmes"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t("portfolio.backToList")}
        </Link>

        <header>
          <h1 className="text-2xl font-semibold">{t("portfolio.title")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("portfolio.description")}
          </p>
        </header>

        {/* Aggregate KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Layers className="size-6 text-slate-500" />
              <div>
                <div className="text-2xl font-semibold">
                  {data.journeyCount}
                </div>
                <div className="text-xs text-slate-500">
                  {t("portfolio.kpiJourneys")}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="text-2xl font-semibold">
                {data.totals.completedSteps}/{data.totals.totalSteps}
              </div>
              <div className="text-xs text-slate-500">
                {t("portfolio.kpiSteps")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="size-6 text-red-600" />
              <div>
                <div className="text-2xl font-semibold text-red-700">
                  {data.totals.overdueSteps}
                </div>
                <div className="text-xs text-slate-500">
                  {t("portfolio.kpiOverdue")}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="size-6 text-amber-600" />
              <div>
                <div className="text-2xl font-semibold text-amber-700">
                  {data.totals.blockedSteps}
                </div>
                <div className="text-xs text-slate-500">
                  {t("portfolio.kpiBlocked")}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Star className="size-6 text-blue-600" />
              <div>
                <div className="text-2xl font-semibold text-blue-700">
                  {data.totals.milestonesNext30d}
                </div>
                <div className="text-xs text-slate-500">
                  {t("portfolio.kpiMilestones30d")}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <span className="text-xs text-slate-500">
              {t("portfolio.filterMsType")}:
            </span>
            <select
              value={msTypeFilter}
              onChange={(e) => setMsTypeFilter(e.target.value)}
              className="h-8 rounded border border-slate-200 bg-transparent px-2 text-sm dark:border-slate-700"
            >
              <option value="">{t("portfolio.allMsTypes")}</option>
              {msTypes.map((m) => (
                <option key={m} value={m}>
                  {t(`msType.${m}`)}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((j) => (
            <Card key={j.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <Link
                    href={`/programmes/${j.id}`}
                    className="text-base hover:underline"
                  >
                    {j.name}
                  </Link>
                  <ProgrammeStatusBadge
                    status={j.status as Parameters<
                      typeof ProgrammeStatusBadge
                    >[0]["status"]}
                  />
                </CardTitle>
                <p className="text-xs font-mono uppercase text-slate-500">
                  {t(`msType.${j.msType}`)} · {j.templateCode}@
                  {j.templateVersion}
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <ProgrammeProgressBar percent={j.progressPercent} />
                  <span className="font-mono text-xs">
                    {Math.round(j.progressPercent)}%
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <div className="text-slate-500">
                      {t("portfolio.cardSteps")}
                    </div>
                    <div className="font-mono font-semibold">
                      {j.steps.completed}/{j.steps.total}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">
                      {t("portfolio.cardSubtasks")}
                    </div>
                    <div className="font-mono font-semibold">
                      {j.subtasks.completed}/{j.subtasks.total}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">
                      {t("portfolio.cardOverdue")}
                    </div>
                    <div
                      className={
                        "font-mono font-semibold " +
                        (j.steps.overdue > 0 ? "text-red-700" : "")
                      }
                    >
                      {j.steps.overdue}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">
                      {t("portfolio.cardMilestones")}
                    </div>
                    <div className="font-mono font-semibold">
                      {j.steps.milestoneIn30d}
                    </div>
                  </div>
                </div>
                {j.targetCompletionDate && (
                  <div className="mt-3 text-xs text-slate-500">
                    {t("portfolio.targetDate")}: {j.targetCompletionDate}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                {t("portfolio.empty")}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ModuleGate>
  );
}
