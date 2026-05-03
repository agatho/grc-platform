"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { ProgrammeStepStatusBadge } from "@/components/programme/programme-status-badge";
import type { ProgrammeStepStatus } from "@grc/shared";

interface WorkItem {
  kind: "step" | "subtask";
  id: string;
  title: string;
  code: string | null;
  status: ProgrammeStepStatus | "in_progress" | "pending" | "completed" | "skipped";
  dueDate: string | null;
  isMandatory?: boolean;
  isMilestone?: boolean;
  deliverableType?: string | null;
  journeyId: string;
  journeyName: string;
  journeyMsType: string;
  journeyTemplateCode: string;
  parentStepId?: string;
  parentStepCode?: string;
  parentStepName?: string;
  overdueDays: number | null;
}

interface JourneyGroup {
  id: string;
  name: string;
  msType: string;
  items: WorkItem[];
}

interface MyWorkResponse {
  totalCount: number;
  overdueCount: number;
  dueIn7Days: number;
  journeys: JourneyGroup[];
  items: WorkItem[];
}

const MS_TYPES = [
  "isms",
  "bcms",
  "dpms",
  "aims",
  "esg",
  "tcms",
  "iccs",
  "other",
] as const;

export default function MyWorkPage() {
  const t = useTranslations("programme");
  const [data, setData] = useState<MyWorkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [msTypeFilter, setMsTypeFilter] = useState<string>("");

  async function load() {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (includeCompleted) params.set("includeCompleted", "1");
      if (msTypeFilter) params.set("msType", msTypeFilter);
      const r = await fetch(`/api/v1/programmes/my-work?${params}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setData(j.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeCompleted, msTypeFilter]);

  if (error) {
    return (
      <ModuleGate moduleKey="programme">
        <div className="p-6">
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        </div>
      </ModuleGate>
    );
  }

  if (!data) {
    return (
      <ModuleGate moduleKey="programme">
        <div className="flex items-center gap-2 p-6 text-slate-500">
          <Loader2 className="size-4 animate-spin" /> {t("loading")}
        </div>
      </ModuleGate>
    );
  }

  return (
    <ModuleGate moduleKey="programme">
      <div className="space-y-6 p-6">
        <Link
          href="/programmes"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t("myWork.backToList")}
        </Link>

        <header>
          <h1 className="text-2xl font-semibold">{t("myWork.title")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("myWork.description")}
          </p>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <CalendarClock className="size-6 text-slate-500" />
              <div>
                <div className="text-2xl font-semibold">{data.totalCount}</div>
                <div className="text-xs text-slate-500">
                  {t("myWork.kpiTotal")}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="size-6 text-red-600" />
              <div>
                <div className="text-2xl font-semibold text-red-700">
                  {data.overdueCount}
                </div>
                <div className="text-xs text-slate-500">
                  {t("myWork.kpiOverdue")}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle2 className="size-6 text-amber-600" />
              <div>
                <div className="text-2xl font-semibold text-amber-700">
                  {data.dueIn7Days}
                </div>
                <div className="text-xs text-slate-500">
                  {t("myWork.kpiDueSoon")}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 py-3">
            <Filter className="size-4 text-slate-500" />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeCompleted}
                onChange={(e) => setIncludeCompleted(e.target.checked)}
                className="size-4 rounded border-slate-300"
              />
              {t("myWork.filterIncludeCompleted")}
            </label>
            <select
              value={msTypeFilter}
              onChange={(e) => setMsTypeFilter(e.target.value)}
              className="h-8 rounded border border-slate-200 bg-transparent px-2 text-sm dark:border-slate-700"
            >
              <option value="">{t("myWork.filterAllMsTypes")}</option>
              {MS_TYPES.map((m) => (
                <option key={m} value={m}>
                  {t(`msType.${m}`)}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {data.journeys.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              {includeCompleted
                ? t("myWork.emptyAll")
                : t("myWork.emptyOpen")}
            </CardContent>
          </Card>
        )}

        {data.journeys.map((journey) => (
          <Card key={journey.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-3">
                <Link
                  href={`/programmes/${journey.id}`}
                  className="text-base hover:underline"
                >
                  {journey.name}
                </Link>
                <Badge variant="outline" className="font-mono text-xs">
                  {t(`msType.${journey.msType}`)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {journey.items.map((it) => {
                  const isStep = it.kind === "step";
                  const href = isStep
                    ? `/programmes/${it.journeyId}/steps/${it.id}`
                    : `/programmes/${it.journeyId}/steps/${it.parentStepId}`;
                  const overdue =
                    (it.overdueDays ?? -1) > 0 && it.status !== "completed";
                  return (
                    <li
                      key={`${it.kind}-${it.id}`}
                      className="flex items-start gap-3 py-3"
                    >
                      <div className="mt-0.5 shrink-0">
                        <ProgrammeStepStatusBadge
                          status={it.status as ProgrammeStepStatus}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={href}
                          className="font-medium hover:underline"
                        >
                          {it.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <Badge
                            variant={isStep ? "default" : "outline"}
                            className="text-xs"
                          >
                            {isStep
                              ? t("myWork.kindStep")
                              : t("myWork.kindSubtask")}
                          </Badge>
                          {it.code && (
                            <span className="font-mono">{it.code}</span>
                          )}
                          {!isStep && it.parentStepCode && (
                            <span className="font-mono">
                              {t("myWork.partOf")} {it.parentStepCode}
                            </span>
                          )}
                          {it.isMilestone && (
                            <Badge variant="outline" className="text-xs">
                              {t("step.milestone")}
                            </Badge>
                          )}
                          {it.deliverableType && (
                            <Badge variant="outline" className="text-xs">
                              {t(`subtask.deliverable.${it.deliverableType}`, {
                                default: it.deliverableType,
                              })}
                            </Badge>
                          )}
                          {it.dueDate && (
                            <span
                              className={
                                overdue ? "font-semibold text-red-700" : ""
                              }
                            >
                              {overdue
                                ? t("myWork.overdueDays", {
                                    days: it.overdueDays ?? 0,
                                  })
                                : `${t("step.dueDate")}: ${it.dueDate}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                      >
                        <Link href={href}>{t("myWork.openStep")}</Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </ModuleGate>
  );
}
