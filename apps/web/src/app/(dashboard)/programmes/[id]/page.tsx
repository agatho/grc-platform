"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2 } from "lucide-react";
import { ProgrammeStatusBadge } from "@/components/programme/programme-status-badge";
import { ProgrammeProgressBar } from "@/components/programme/programme-progress-bar";
import { NextActionsWidget } from "@/components/programme/next-actions-widget";
import { BlockersAlert } from "@/components/programme/blockers-alert";
import {
  PhaseKanban,
  type KanbanPhase,
  type KanbanStep,
} from "@/components/programme/phase-kanban";
import type { ProgrammeJourneyStatus } from "@grc/shared";
import { use } from "react";

interface DashboardData {
  journey: {
    id: string;
    name: string;
    description: string | null;
    status: ProgrammeJourneyStatus;
    msType: string;
    templateCode: string;
    templateVersion: string;
    progressPercent: string;
    healthReason: string | null;
    startedAt: string | null;
    targetCompletionDate: string | null;
  };
  health: {
    derivedStatus: string;
    reason: string;
    healthScore: number;
    aggregates: {
      totalSteps: number;
      completedSteps: number;
      inProgressSteps: number;
      blockedSteps: number;
      overdueSteps: number;
    };
  } | null;
  phases: KanbanPhase[];
  milestones: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    dueDate: string | null;
    isoClause: string | null;
  }>;
}

export default function ProgrammeCockpitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("programme");
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [steps, setSteps] = useState<KanbanStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/programmes/journeys/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? j.reason ?? `HTTP ${r.status}`);
      }
      router.push("/programmes");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dashRes, stepsRes] = await Promise.all([
          fetch(`/api/v1/programmes/journeys/${id}/dashboard`),
          fetch(`/api/v1/programmes/journeys/${id}/steps`),
        ]);
        if (!dashRes.ok) throw new Error(`Dashboard HTTP ${dashRes.status}`);
        if (!stepsRes.ok) throw new Error(`Steps HTTP ${stepsRes.status}`);
        const dashJson = await dashRes.json();
        const stepsJson = await stepsRes.json();
        if (!cancelled) {
          setData(dashJson.data);
          setSteps(stepsJson.data ?? []);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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

  const j = data.journey;
  const pct = parseFloat(j.progressPercent);

  return (
    <ModuleGate moduleKey="programme">
      <div className="space-y-6 p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{j.name}</h1>
              <ProgrammeStatusBadge status={j.status} />
            </div>
            <p className="mt-1 text-xs font-mono uppercase text-slate-500">
              {t(`msType.${j.msType}`)} • {j.templateCode}@{j.templateVersion}
            </p>
            {j.description && (
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                {j.description}
              </p>
            )}
            {j.healthReason && (
              <p className="mt-2 text-sm text-slate-500">
                <span className="font-semibold">{t("dashboard.health")}:</span>{" "}
                {j.healthReason}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button asChild variant="outline">
              <Link href={`/programmes/${id}/timeline`}>
                {t("dashboard.openTimeline")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/programmes/${id}/events`}>
                {t("dashboard.openEvents")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a
                href={`/api/v1/programmes/journeys/${id}/audit-pack`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("dashboard.auditPack")}
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(true);
                setDeleteConfirm("");
              }}
              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
            >
              <Trash2 className="mr-2 size-4" />
              {t("dashboard.deleteJourney")}
            </Button>
          </div>
        </header>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("dashboard.deleteDialogTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <span className="block">
                  {t("dashboard.deleteDialogBody", { name: j.name })}
                </span>
                <span className="block text-xs text-slate-500">
                  {t("dashboard.deleteDialogSoftHint")}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm-input">
                {t("dashboard.deleteConfirmLabel", { name: j.name })}
              </Label>
              <Input
                id="delete-confirm-input"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                autoComplete="off"
                placeholder={j.name}
              />
            </div>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
                {error}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>
                {t("dashboard.deleteCancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={deleting || deleteConfirm !== j.name}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deleting && <Loader2 className="mr-2 size-4 animate-spin" />}
                {t("dashboard.deleteConfirmButton")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <BlockersAlert journeyId={id} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("dashboard.progressTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <ProgrammeProgressBar percent={pct} />
                <span className="font-mono text-sm">{Math.round(pct)}%</span>
              </div>
              {data.health && (
                <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500">
                      {t("dashboard.aggregate.total")}
                    </dt>
                    <dd className="font-mono">
                      {data.health.aggregates.totalSteps}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {t("dashboard.aggregate.completed")}
                    </dt>
                    <dd className="font-mono text-emerald-700">
                      {data.health.aggregates.completedSteps}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {t("dashboard.aggregate.inProgress")}
                    </dt>
                    <dd className="font-mono">
                      {data.health.aggregates.inProgressSteps}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {t("dashboard.aggregate.blocked")}
                    </dt>
                    <dd className="font-mono text-red-700">
                      {data.health.aggregates.blockedSteps}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {t("dashboard.aggregate.overdue")}
                    </dt>
                    <dd className="font-mono text-red-700">
                      {data.health.aggregates.overdueSteps}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">
                      {t("dashboard.aggregate.healthScore")}
                    </dt>
                    <dd className="font-mono">{data.health.healthScore}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>
          <NextActionsWidget journeyId={id} limit={5} />
        </div>

        <PhaseKanban journeyId={id} phases={data.phases} steps={steps} />
      </div>
    </ModuleGate>
  );
}
