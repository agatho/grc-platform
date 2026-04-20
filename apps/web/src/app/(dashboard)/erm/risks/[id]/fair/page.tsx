"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Play,
  Save,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Settings2,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FAIRParams {
  lefMin: number;
  lefMostLikely: number;
  lefMax: number;
  lmMin: number;
  lmMostLikely: number;
  lmMax: number;
  lossComponents: {
    productivity: number;
    response: number;
    replacement: number;
    fines: number;
    judgments: number;
    reputation: number;
  };
}

interface SimResult {
  id: string;
  status: string;
  aleP5?: string;
  aleP25?: string;
  aleP50?: string;
  aleP75?: string;
  aleP95?: string;
  aleMean?: string;
  aleStdDev?: string;
  histogram?: Array<{
    bucket: number;
    bucketMax: number;
    count: number;
    percentage: number;
  }>;
  lossExceedance?: Array<{ threshold: number; probability: number }>;
  sensitivity?: Array<{ parameter: string; impact: number; label: string }>;
  computedAt?: string;
  iterations: number;
}

const DEFAULT_PARAMS: FAIRParams = {
  lefMin: 0.1,
  lefMostLikely: 1,
  lefMax: 5,
  lmMin: 50000,
  lmMostLikely: 200000,
  lmMax: 1000000,
  lossComponents: {
    productivity: 30,
    response: 20,
    replacement: 10,
    fines: 15,
    judgments: 10,
    reputation: 15,
  },
};

const COMPONENT_KEYS = [
  "productivity",
  "response",
  "replacement",
  "fines",
  "judgments",
  "reputation",
] as const;

export default function FAIRParametersPage() {
  return (
    <ModuleGate moduleKey="erm">
      <FAIRParametersInner />
    </ModuleGate>
  );
}

function FAIRParametersInner() {
  const t = useTranslations("fair");
  const params = useParams();
  const router = useRouter();
  const riskId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [methodology, setMethodology] = useState<string>("qualitative");
  const [fairParams, setFairParams] = useState<FAIRParams>(DEFAULT_PARAMS);
  const [latestResult, setLatestResult] = useState<SimResult | null>(null);
  const [iterations, setIterations] = useState("10000");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch methodology
      const methRes = await fetch("/api/v1/erm/fair/methodology");
      if (methRes.ok) {
        const methData = await methRes.json();
        setMethodology(methData.data?.riskMethodology ?? "qualitative");
      }

      // Fetch FAIR params
      const paramsRes = await fetch(`/api/v1/erm/risks/${riskId}/fair`);
      if (paramsRes.ok) {
        const paramsData = await paramsRes.json();
        if (paramsData.data) {
          setFairParams({
            lefMin: Number(paramsData.data.lefMin),
            lefMostLikely: Number(paramsData.data.lefMostLikely),
            lefMax: Number(paramsData.data.lefMax),
            lmMin: Number(paramsData.data.lmMin),
            lmMostLikely: Number(paramsData.data.lmMostLikely),
            lmMax: Number(paramsData.data.lmMax),
            lossComponents:
              paramsData.data.lossComponents ?? DEFAULT_PARAMS.lossComponents,
          });
        }
      }

      // Fetch latest results
      const resultsRes = await fetch(
        `/api/v1/erm/risks/${riskId}/fair/results`,
      );
      if (resultsRes.ok) {
        const resultsData = await resultsRes.json();
        setLatestResult(resultsData.data?.latest ?? null);
      }
    } catch (err) {
      setError(t("fetchError"));
    } finally {
      setLoading(false);
    }
  }, [riskId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/erm/risks/${riskId}/fair`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fairParams),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t("saveError"));
      }
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    setError(null);
    try {
      // Save first
      await fetch(`/api/v1/erm/risks/${riskId}/fair`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fairParams),
      });

      // Run simulation
      const res = await fetch(`/api/v1/erm/risks/${riskId}/fair/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iterations: Number(iterations) }),
      });

      if (res.ok) {
        const data = await res.json();
        setLatestResult(data.data);
        router.push(`/erm/risks/${riskId}/fair/results`);
      } else {
        const data = await res.json();
        setError(data.error ?? t("simulationError"));
      }
    } catch {
      setError(t("simulationError"));
    } finally {
      setSimulating(false);
    }
  };

  const updateParam = (
    key: keyof Omit<FAIRParams, "lossComponents">,
    value: string,
  ) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setFairParams((prev) => ({ ...prev, [key]: num }));
    }
  };

  const updateComponent = (key: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setFairParams((prev) => ({
        ...prev,
        lossComponents: { ...prev.lossComponents, [key]: num },
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (methodology === "qualitative") {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">{t("notEnabled")}</h2>
          <p className="text-muted-foreground mb-4">{t("notEnabledDesc")}</p>
          <p className="text-sm text-muted-foreground">
            {t("enableInSettings")}
          </p>
        </Card>
      </div>
    );
  }

  const componentSum = Object.values(fairParams.lossComponents).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={methodology === "fair" ? "default" : "secondary"}>
            {methodology === "fair" ? "FAIR" : t("hybrid")}
          </Badge>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Loss Event Frequency */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">{t("lefTitle")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{t("lefDesc")}</p>

          <div className="space-y-3">
            <div>
              <Label>{t("minimum")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={fairParams.lefMin}
                onChange={(e) => updateParam("lefMin", e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("lefMinHelp")}
              </p>
            </div>
            <div>
              <Label>{t("mostLikely")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={fairParams.lefMostLikely}
                onChange={(e) => updateParam("lefMostLikely", e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("lefMostLikelyHelp")}
              </p>
            </div>
            <div>
              <Label>{t("maximum")}</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={fairParams.lefMax}
                onChange={(e) => updateParam("lefMax", e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("lefMaxHelp")}
              </p>
            </div>
          </div>
        </Card>

        {/* Right Column: Loss Magnitude */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold">{t("lmTitle")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">{t("lmDesc")}</p>

          <div className="space-y-3">
            <div>
              <Label>{t("minimum")} (EUR)</Label>
              <Input
                type="number"
                step="1000"
                min="0"
                value={fairParams.lmMin}
                onChange={(e) => updateParam("lmMin", e.target.value)}
              />
            </div>
            <div>
              <Label>{t("mostLikely")} (EUR)</Label>
              <Input
                type="number"
                step="1000"
                min="0"
                value={fairParams.lmMostLikely}
                onChange={(e) => updateParam("lmMostLikely", e.target.value)}
              />
            </div>
            <div>
              <Label>{t("maximum")} (EUR)</Label>
              <Input
                type="number"
                step="1000"
                min="0"
                value={fairParams.lmMax}
                onChange={(e) => updateParam("lmMax", e.target.value)}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Loss Components */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold">{t("lossComponents")}</h2>
          </div>
          <Badge
            variant={
              Math.abs(componentSum - 100) < 0.01 ? "default" : "destructive"
            }
          >
            {componentSum.toFixed(0)}%
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("lossComponentsDesc")}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {COMPONENT_KEYS.map((key) => (
            <div key={key}>
              <Label>{t(`component.${key}`)}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={fairParams.lossComponents[key]}
                  onChange={(e) => updateComponent(key, e.target.value)}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Simulation Settings & Actions */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="flex-1">
            <Label>{t("iterations")}</Label>
            <Select value={iterations} onValueChange={setIterations}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1,000</SelectItem>
                <SelectItem value="10000">10,000</SelectItem>
                <SelectItem value="100000">100,000</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {t("saveParams")}
            </Button>
            <Button onClick={handleSimulate} disabled={simulating}>
              {simulating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Play className="mr-2 h-4 w-4" />
              {t("runSimulation")}
            </Button>
          </div>
        </div>
      </Card>

      {/* Latest Result Summary */}
      {latestResult && latestResult.status === "completed" && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t("latestResult")}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t("aleP50")}</p>
              <p className="text-2xl font-bold text-green-700">
                {formatEUR(Number(latestResult.aleP50))}
              </p>
              <p className="text-xs text-muted-foreground">{t("median")}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t("aleP95")}</p>
              <p className="text-2xl font-bold text-red-700">
                {formatEUR(Number(latestResult.aleP95))}
              </p>
              <p className="text-xs text-muted-foreground">VaR (95%)</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t("aleMean")}</p>
              <p className="text-2xl font-bold">
                {formatEUR(Number(latestResult.aleMean))}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t("aleStdDev")}</p>
              <p className="text-2xl font-bold text-muted-foreground">
                {formatEUR(Number(latestResult.aleStdDev))}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => router.push(`/erm/risks/${riskId}/fair/results`)}
            >
              {t("viewDetailedResults")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function formatEUR(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}
