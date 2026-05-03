"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { ProgrammeStatusBadge } from "@/components/programme/programme-status-badge";
import { ProgrammeProgressBar } from "@/components/programme/programme-progress-bar";
import type { ProgrammeJourneyStatus } from "@grc/shared";

interface JourneyRow {
  id: string;
  name: string;
  description: string | null;
  status: ProgrammeJourneyStatus;
  msType: string;
  templateCode: string;
  templateVersion: string;
  progressPercent: string;
  startedAt: string | null;
  targetCompletionDate: string | null;
}

export default function ProgrammesListPage() {
  const t = useTranslations("programme");
  const [journeys, setJourneys] = useState<JourneyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/v1/programmes/journeys");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setJourneys(json.data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(j: JourneyRow) {
    const ok = window.confirm(t("list.confirmDelete", { name: j.name }));
    if (!ok) return;
    setDeletingId(j.id);
    try {
      const r = await fetch(`/api/v1/programmes/journeys/${j.id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        throw new Error(json.error ?? json.reason ?? `HTTP ${r.status}`);
      }
      // Optimistic UI: remove from local state immediately, then re-fetch.
      setJourneys((prev) => (prev ?? []).filter((x) => x.id !== j.id));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <ModuleGate moduleKey="programme">
      <div className="space-y-6 p-6">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t("list.title")}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("list.description")}</p>
          </div>
          <Button asChild>
            <Link href="/programmes/new">
              <Plus className="mr-2 size-4" />
              {t("list.createButton")}
            </Link>
          </Button>
        </header>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {journeys == null && !error && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="size-4 animate-spin" /> {t("loading")}
          </div>
        )}

        {journeys && journeys.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-500">{t("list.empty")}</p>
              <Button asChild className="mt-4">
                <Link href="/programmes/new">{t("list.createButton")}</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {journeys && journeys.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {journeys.map((j) => {
              const pct = parseFloat(j.progressPercent);
              return (
                <Card key={j.id} className="transition hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-start justify-between gap-2">
                      <Link
                        href={`/programmes/${j.id}`}
                        className="text-lg hover:underline"
                      >
                        {j.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <ProgrammeStatusBadge status={j.status} />
                        <button
                          type="button"
                          onClick={() => handleDelete(j)}
                          disabled={deletingId === j.id}
                          title={t("list.delete")}
                          className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950"
                        >
                          {deletingId === j.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </button>
                      </div>
                    </CardTitle>
                    <p className="text-xs font-mono uppercase text-slate-500">
                      {t(`msType.${j.msType}`)} • {j.templateCode}@
                      {j.templateVersion}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {j.description && (
                      <p className="mb-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                        {j.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <ProgrammeProgressBar percent={pct} />
                      <span className="font-mono text-xs text-slate-500">
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-slate-500">
                      {j.startedAt && (
                        <span>
                          {t("list.startedAt")}: {j.startedAt}
                        </span>
                      )}
                      {j.targetCompletionDate && (
                        <span>
                          {t("list.targetDate")}: {j.targetCompletionDate}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ModuleGate>
  );
}
