"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Play } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ScenarioDetail {
  id: string;
  simulationType: string;
  name: string;
  description: string | null;
  tag: string;
  status: string;
  assumptionsJson: string[];
}

interface Run {
  id: string;
  runNumber: number;
  iterations: number;
  status: string;
  durationMs: number | null;
  startedAt: string;
  completedAt: string | null;
}

interface Parameter {
  id: string;
  parameterKey: string;
  displayName: string;
  minValue: string | null;
  maxValue: string | null;
  defaultValue: string | null;
  distribution: string | null;
  unit: string | null;
}

export default function ScenarioDetailPage() {
  return (
    <ModuleGate moduleKey="simulations">
      <ScenarioDetail />
    </ModuleGate>
  );
}

function ScenarioDetail() {
  const t = useTranslations("simulations");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, rRes, pRes] = await Promise.all([
        fetch(`/api/v1/simulations/scenarios/${id}`),
        fetch(`/api/v1/simulations/runs?scenarioId=${id}`),
        fetch(`/api/v1/simulations/parameters?scenarioId=${id}`),
      ]);
      if (sRes.ok) setScenario((await sRes.json()).data);
      if (rRes.ok) setRuns((await rRes.json()).data ?? []);
      if (pRes.ok) setParameters((await pRes.json()).data ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleRun = async () => {
    const res = await fetch("/api/v1/simulations/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioId: id, iterations: 10000 }),
    });
    if (res.ok) void fetchData();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;
  if (!scenario) return <div className="text-center py-12 text-gray-400">{t("notFound")}</div>;

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> {t("backToScenarios")}
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{scenario.name}</h1>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline">{scenario.simulationType.replace(/_/g, " ")}</Badge>
            <Badge variant="outline">{scenario.tag.replace(/_/g, " ")}</Badge>
            <Badge variant="outline">{scenario.status}</Badge>
          </div>
        </div>
        <Button onClick={handleRun}><Play size={14} className="mr-1" /> {t("runSimulation")}</Button>
      </div>

      {scenario.description && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-700">{scenario.description}</p>
        </div>
      )}

      {/* Parameters */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold mb-4">{t("parameters")} ({parameters.length})</h2>
        {parameters.length === 0 ? (
          <p className="text-sm text-gray-400">{t("noParameters")}</p>
        ) : (
          <div className="space-y-2">
            {parameters.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border border-gray-100 p-3 text-sm">
                <div>
                  <span className="font-medium">{p.displayName}</span>
                  <span className="text-gray-400 ml-2">({p.parameterKey})</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  {p.minValue && <span>{t("min")}: {p.minValue}</span>}
                  {p.maxValue && <span>{t("max")}: {p.maxValue}</span>}
                  {p.distribution && <span>{p.distribution}</span>}
                  {p.unit && <span>{p.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Runs */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold mb-4">{t("runs")} ({runs.length})</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-gray-400">{t("noRuns")}</p>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded border border-gray-100 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">#{r.runNumber}</span>
                  <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                  <span className="text-gray-400">{r.iterations.toLocaleString()} {t("iterations")}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {r.durationMs && <span>{r.durationMs}ms</span>}
                  <span className="ml-2">{new Date(r.startedAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
