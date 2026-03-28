"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Play,
  History,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RegulationSimulation, SimulationScenarioType } from "@grc/shared";

const SCENARIO_TYPES: { value: SimulationScenarioType; label: string }[] = [
  { value: "add_requirement", label: "New requirement added" },
  { value: "tighten", label: "Existing requirement tightened" },
  { value: "shorten_deadline", label: "Deadline shortened" },
  { value: "add_reporting", label: "New notification obligation" },
];

export default function SimulatorPage() {
  return (
    <ModuleGate moduleKey="ics">
      <SimulatorInner />
    </ModuleGate>
  );
}

function SimulatorInner() {
  const t = useTranslations("simulator");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegulationSimulation | null>(null);

  // Form state
  const [regulationName, setRegulationName] = useState("");
  const [scenarioType, setScenarioType] = useState<SimulationScenarioType>("add_requirement");

  const runSimulation = useCallback(async () => {
    if (!regulationName) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/compliance/simulator/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regulationName,
          scenarioType,
          parameters: {},
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setResult(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [regulationName, scenarioType]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/compliance/simulator/history")}>
          <History className="mr-2 h-4 w-4" />
          {t("history")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Scenario Definition */}
        <Card>
          <CardHeader>
            <CardTitle>{t("scenarioDefinition")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("regulationName")}</Label>
              <Input
                value={regulationName}
                onChange={(e) => setRegulationName(e.target.value)}
                placeholder={t("regulationPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("scenarioType")}</Label>
              <Select value={scenarioType} onValueChange={(v) => setScenarioType(v as SimulationScenarioType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIO_TYPES.map((st) => (
                    <SelectItem key={st.value} value={st.value}>
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={runSimulation} disabled={loading || !regulationName}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              {t("runSimulation")}
            </Button>
          </CardContent>
        </Card>

        {/* Result Visualization */}
        <Card>
          <CardHeader>
            <CardTitle>{t("results")}</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <p className="text-muted-foreground">{t("noResults")}</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">{t("before")}</p>
                    <p className="text-2xl font-bold">{Number(result.beforeScore).toFixed(1)}%</p>
                  </div>
                  <TrendingDown className="h-6 w-6 text-destructive" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">{t("after")}</p>
                    <p className="text-2xl font-bold text-destructive">{Number(result.afterScore).toFixed(1)}%</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Badge variant="destructive">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    {result.gapCount} {t("gaps")}
                  </Badge>
                  {result.estimatedTotalCost && (
                    <Badge variant="secondary">
                      {Number(result.estimatedTotalCost).toLocaleString("de-DE")} EUR
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">{t("identifiedGaps")}</h4>
                  {(result.gapsJson as Array<{ requirement: string; missingControl: string; effort: string }>).map((gap, i) => (
                    <div key={i} className="rounded border p-3 text-sm">
                      <p className="font-medium">{gap.requirement}</p>
                      <p className="text-muted-foreground">{gap.missingControl}</p>
                      <Badge variant="outline" className="mt-1">{gap.effort}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
