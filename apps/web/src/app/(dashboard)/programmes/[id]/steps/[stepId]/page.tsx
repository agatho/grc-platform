"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProgrammeStepStatusBadge } from "@/components/programme/programme-status-badge";
import {
  PROGRAMME_STEP_STATUSES,
  type ProgrammeStepStatus,
} from "@grc/shared";

interface StepDetail {
  step: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    isoClause: string | null;
    status: ProgrammeStepStatus;
    ownerId: string | null;
    dueDate: string | null;
    completionNotes: string | null;
    skipReason: string | null;
    blockReason: string | null;
    requiredEvidenceCount: number;
    evidenceLinks: Array<{ type: string; id: string; label?: string }>;
    targetModuleLink: { module?: string; route?: string };
    isMilestone: boolean;
  };
  template: {
    description: string | null;
    prerequisiteStepCodes: string[];
  } | null;
}

export default function StepDetailPage({
  params,
}: {
  params: Promise<{ id: string; stepId: string }>;
}) {
  const { id, stepId } = use(params);
  const t = useTranslations("programme");
  const [data, setData] = useState<StepDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transitionTarget, setTransitionTarget] = useState<
    ProgrammeStepStatus | ""
  >("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setError(null);
    try {
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}`,
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, stepId]);

  async function handleTransition(e: React.FormEvent) {
    e.preventDefault();
    if (!transitionTarget) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/v1/programmes/journeys/${id}/steps/${stepId}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: transitionTarget,
            reason: reason || undefined,
          }),
        },
      );
      const json = await r.json();
      if (!r.ok) {
        throw new Error(json.reason ?? json.error ?? `HTTP ${r.status}`);
      }
      setTransitionTarget("");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !data) {
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

  const step = data.step;
  const evidenceProvided = step.evidenceLinks?.length ?? 0;

  return (
    <ModuleGate moduleKey="programme">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <Link
          href={`/programmes/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t("step.backToCockpit")}
        </Link>
        <header>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{step.name}</h1>
              <p className="mt-1 text-xs font-mono uppercase text-slate-500">
                {step.code}
                {step.isoClause && ` • ${step.isoClause}`}
              </p>
            </div>
            <ProgrammeStepStatusBadge status={step.status} />
          </div>
          {step.description && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {step.description}
            </p>
          )}
        </header>

        <Card>
          <CardHeader>
            <CardTitle>{t("step.detailsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-slate-500">{t("step.dueDate")}</dt>
                <dd>{step.dueDate ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">
                  {t("step.requiredEvidence")}
                </dt>
                <dd>
                  {evidenceProvided}/{step.requiredEvidenceCount}
                </dd>
              </div>
              {step.blockReason && (
                <div className="col-span-2">
                  <dt className="text-slate-500">{t("step.blockReason")}</dt>
                  <dd className="text-red-700">{step.blockReason}</dd>
                </div>
              )}
              {step.skipReason && (
                <div className="col-span-2">
                  <dt className="text-slate-500">{t("step.skipReason")}</dt>
                  <dd>{step.skipReason}</dd>
                </div>
              )}
              {data.template?.prerequisiteStepCodes &&
                data.template.prerequisiteStepCodes.length > 0 && (
                  <div className="col-span-2">
                    <dt className="text-slate-500">
                      {t("step.prerequisites")}
                    </dt>
                    <dd className="font-mono text-xs">
                      {data.template.prerequisiteStepCodes.join(", ")}
                    </dd>
                  </div>
                )}
              {step.targetModuleLink?.route && (
                <div className="col-span-2">
                  <dt className="text-slate-500">
                    {t("step.targetModule")}
                  </dt>
                  <dd>
                    <Link
                      href={step.targetModuleLink.route}
                      className="text-blue-600 hover:underline"
                    >
                      {step.targetModuleLink.route}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("step.transitionTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTransition} className="space-y-3">
              <div>
                <label className="text-sm font-medium">
                  {t("step.transitionTarget")}
                </label>
                <select
                  value={transitionTarget}
                  onChange={(e) =>
                    setTransitionTarget(e.target.value as ProgrammeStepStatus)
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                  required
                >
                  <option value="">{t("step.selectTarget")}</option>
                  {PROGRAMME_STEP_STATUSES.filter(
                    (s) => s !== step.status,
                  ).map((s) => (
                    <option key={s} value={s}>
                      {t(`status.step.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              {(transitionTarget === "skipped" ||
                transitionTarget === "blocked") && (
                <div>
                  <label className="text-sm font-medium">
                    {t("step.reason")}{" "}
                    <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    minLength={5}
                    maxLength={1000}
                    rows={2}
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                    placeholder={t("step.reasonPlaceholder")}
                  />
                </div>
              )}
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={submitting || !transitionTarget}
                >
                  {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {t("step.applyTransition")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ModuleGate>
  );
}
