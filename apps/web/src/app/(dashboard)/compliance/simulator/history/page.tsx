"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, GitCompare, ArrowLeft } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { RegulationSimulation } from "@grc/shared";

export default function SimulatorHistoryPage() {
  return (
    <ModuleGate moduleKey="ics">
      <HistoryInner />
    </ModuleGate>
  );
}

function HistoryInner() {
  const t = useTranslations("simulator");
  const router = useRouter();
  const [simulations, setSimulations] = useState<RegulationSimulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchSimulations = async () => {
      try {
        const res = await fetch(
          "/api/v1/compliance/simulator/simulations?limit=100",
        );
        if (res.ok) {
          const json = await res.json();
          setSimulations(json.data ?? []);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchSimulations();
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 2) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const canCompare = selected.size === 2;

  const handleCompare = useCallback(() => {
    const ids = Array.from(selected).join(",");
    router.push(`/compliance/simulator/history?compare=${ids}`);
  }, [selected, router]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/compliance/simulator")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">{t("historyTitle")}</h1>
        </div>
        <Button disabled={!canCompare} onClick={handleCompare}>
          <GitCompare className="mr-2 h-4 w-4" />
          {t("compare")}
        </Button>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-10 p-3" />
              <th className="p-3 text-left">{t("date")}</th>
              <th className="p-3 text-left">{t("regulation")}</th>
              <th className="p-3 text-left">{t("scenarioType")}</th>
              <th className="p-3 text-right">{t("beforeScore")}</th>
              <th className="p-3 text-right">{t("afterScore")}</th>
              <th className="p-3 text-right">{t("gapCount")}</th>
            </tr>
          </thead>
          <tbody>
            {simulations.map((sim) => (
              <tr
                key={sim.id}
                className="cursor-pointer border-b hover:bg-muted/25"
                onClick={() => router.push(`/compliance/simulator/${sim.id}`)}
              >
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(sim.id)}
                    onCheckedChange={() => toggleSelect(sim.id)}
                  />
                </td>
                <td className="p-3">
                  {new Date(sim.createdAt).toLocaleDateString("de-DE")}
                </td>
                <td className="p-3 font-medium">{sim.regulationName}</td>
                <td className="p-3">
                  <Badge variant="outline">{sim.scenarioType}</Badge>
                </td>
                <td className="p-3 text-right">
                  {Number(sim.beforeScore).toFixed(1)}%
                </td>
                <td className="p-3 text-right text-destructive">
                  {Number(sim.afterScore).toFixed(1)}%
                </td>
                <td className="p-3 text-right">{sim.gapCount}</td>
              </tr>
            ))}
            {simulations.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center text-muted-foreground"
                >
                  {t("noSimulations")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
