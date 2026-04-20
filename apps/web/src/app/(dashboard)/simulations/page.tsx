"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  Play,
  GitCompare,
  Layers,
  Activity,
  BarChart3,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Scenario {
  id: string;
  simulationType: string;
  name: string;
  description: string | null;
  tag: string;
  status: string;
  createdAt: string;
}

export default function SimulationsPage() {
  return (
    <ModuleGate moduleKey="simulations">
      <SimulationsDashboard />
    </ModuleGate>
  );
}

function SimulationsDashboard() {
  const t = useTranslations("simulations");
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/simulations/scenarios?limit=20");
      if (res.ok) setScenarios((await res.json()).data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const typeIcons: Record<string, React.ReactNode> = {
    what_if: <Layers size={14} className="text-blue-500" />,
    monte_carlo: <BarChart3 size={14} className="text-purple-500" />,
    business_impact: <Activity size={14} className="text-red-500" />,
    bpm_cost_time: <Play size={14} className="text-green-500" />,
    supplier_cascade: <GitCompare size={14} className="text-orange-500" />,
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-50 text-gray-600",
    configuring: "bg-blue-50 text-blue-700",
    running: "bg-yellow-50 text-yellow-700",
    completed: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-700",
    archived: "bg-gray-50 text-gray-500",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/simulations/comparisons">
            <Button variant="outline" size="sm">
              <GitCompare size={14} className="mr-1" />
              {t("comparisons")}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {loading && scenarios.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : scenarios.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {t("noScenarios")}
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios.map((s) => (
            <Link
              key={s.id}
              href={`/simulations/scenarios/${s.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center gap-3">
                {typeIcons[s.simulationType] ?? (
                  <Layers size={14} className="text-gray-400" />
                )}
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {s.name}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={statusColors[s.status] ?? ""}
                    >
                      {s.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {s.tag.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {s.simulationType.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(s.createdAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
