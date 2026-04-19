"use client";

import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Cpu,
  ShieldAlert,
  ClipboardCheck,
  FileCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type RunStatus = "idle" | "running" | "done" | "error";

interface ClassifyResult {
  status: RunStatus;
  data?: {
    isSystemic: boolean;
    tierLevel: "systemic" | "high_capability" | "standard";
    triggers: string[];
    reasoning: string;
  };
  error?: string;
}

interface ObligationsResult {
  status: RunStatus;
  data?: {
    isSystemic: boolean;
    standardPercent: number;
    systemicPercent: number | null;
    standardObligationsMet: number;
    systemicObligationsMet: number;
    missing: string[];
    isFullyCompliant: boolean;
  };
  error?: string;
}

function tierBadge(tier: "systemic" | "high_capability" | "standard") {
  if (tier === "systemic") {
    return (
      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
        <ShieldAlert className="h-3 w-3 mr-1" />
        SYSTEMIC
      </Badge>
    );
  }
  if (tier === "high_capability") {
    return (
      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
        HIGH-CAPABILITY
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-sky-100 text-sky-800 border-sky-300">
      STANDARD
    </Badge>
  );
}

function compliancePill(ok: boolean) {
  return ok ? (
    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      Compliant
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
      <XCircle className="h-3 w-3 mr-1" />
      Gaps
    </Badge>
  );
}

export default function GpaiComplianceWizardPage() {
  const { id } = useParams<{ id: string }>();

  // ─── Classify inputs ─────────────────────────────────────
  const [classify, setClassify] = useState({
    trainingComputeFlops: 0,
    commissionDesignated: false,
    hasHighImpactCapabilities: false,
    parametersCount: 0,
    hasAdvancedReasoning: false,
    hasMultimodalCapabilities: false,
  });
  const [classifyResult, setClassifyResult] = useState<ClassifyResult>({ status: "idle" });

  // ─── Obligations inputs ──────────────────────────────────
  const [obligations, setObligations] = useState({
    respectsCopyrightDirective: false,
    downstreamProviderInfoShared: false,
    isNonEuProvider: false,
    isSystemic: false,
    hasModelEvaluations: false,
    hasSystemicRiskAssessment: false,
  });
  const [obligationsResult, setObligationsResult] = useState<ObligationsResult>({
    status: "idle",
  });

  const runClassify = useCallback(async () => {
    setClassifyResult({ status: "running" });
    try {
      const res = await fetch(`/api/v1/ai-act/gpai/${id}/classify-risk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trainingComputeFlops: classify.trainingComputeFlops || null,
          commissionDesignated: classify.commissionDesignated,
          hasHighImpactCapabilities: classify.hasHighImpactCapabilities,
          parametersCount: classify.parametersCount || null,
          hasAdvancedReasoning: classify.hasAdvancedReasoning,
          hasMultimodalCapabilities: classify.hasMultimodalCapabilities,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const { data } = await res.json();
      setClassifyResult({ status: "done", data });
      // Auto-feed systemic flag into obligations
      setObligations((o) => ({ ...o, isSystemic: data.isSystemic }));
    } catch (e) {
      setClassifyResult({
        status: "error",
        error: e instanceof Error ? e.message : "Fehler",
      });
    }
  }, [id, classify]);

  const runObligations = useCallback(async () => {
    setObligationsResult({ status: "running" });
    try {
      const res = await fetch(`/api/v1/ai-act/gpai/${id}/obligations-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obligations),
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const { data } = await res.json();
      setObligationsResult({ status: "done", data });
    } catch (e) {
      setObligationsResult({
        status: "error",
        error: e instanceof Error ? e.message : "Fehler",
      });
    }
  }, [id, obligations]);

  const runAll = async () => {
    await runClassify();
    // obligations runs with current state; user may want to click it again after classify auto-sets isSystemic
    await runObligations();
  };

  const boolRow = (
    key: string,
    label: string,
    value: boolean,
    onChange: (v: boolean) => void,
  ) => (
    <div className="flex items-center justify-between py-1" key={key}>
      <Label htmlFor={key} className="text-xs cursor-pointer flex-1 pr-2">
        {label}
      </Label>
      <Switch id={key} checked={value} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/ai-act/gpai`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            Zurueck zu GPAI Models
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">GPAI Compliance Wizard</h1>
          <p className="text-muted-foreground mt-1">
            Art. 51-55 Checks: Systemic-Risk-Klassifikation + Art. 53 (Standard) / Art. 55
            (Systemic) Obligations.
          </p>
        </div>
        <Button onClick={runAll}>
          <FileCheck className="h-4 w-4 mr-2" />
          Beide Checks ausfuehren
        </Button>
      </div>

      {/* Section 1: Classify Systemic Risk */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Art. 51 Systemic-Risk Classification</CardTitle>
                <CardDescription>
                  Compute-Threshold (10^25 FLOPs) / Commission-Designierung /
                  High-Impact-Capabilities.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {classifyResult.status === "running" && (
                <Badge variant="outline">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Laeuft...
                </Badge>
              )}
              {classifyResult.status === "done" && classifyResult.data && (
                tierBadge(classifyResult.data.tierLevel)
              )}
              {classifyResult.status === "error" && (
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                  <XCircle className="h-3 w-3 mr-1" />
                  Fehler
                </Badge>
              )}
              <Button size="sm" onClick={runClassify} disabled={classifyResult.status === "running"}>
                Klassifizieren
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label htmlFor="c-flops" className="text-xs">
                Training Compute (FLOPs) -- Systemic-Schwelle: 10^25
              </Label>
              <Input
                id="c-flops"
                type="number"
                min="0"
                step="1e23"
                value={classify.trainingComputeFlops}
                onChange={(e) =>
                  setClassify({
                    ...classify,
                    trainingComputeFlops: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-8 font-mono"
              />
            </div>
            {boolRow(
              "c-designated",
              "Von EU-Kommission als systemic designiert",
              classify.commissionDesignated,
              (v) => setClassify({ ...classify, commissionDesignated: v }),
            )}
            {boolRow(
              "c-highimpact",
              "High-Impact Capabilities (Benchmarks)",
              classify.hasHighImpactCapabilities,
              (v) => setClassify({ ...classify, hasHighImpactCapabilities: v }),
            )}
            {boolRow(
              "c-reasoning",
              "Advanced Reasoning",
              classify.hasAdvancedReasoning,
              (v) => setClassify({ ...classify, hasAdvancedReasoning: v }),
            )}
            {boolRow(
              "c-multimodal",
              "Multimodal Capabilities",
              classify.hasMultimodalCapabilities,
              (v) => setClassify({ ...classify, hasMultimodalCapabilities: v }),
            )}
            <div className="col-span-2">
              <Label htmlFor="c-params" className="text-xs">
                Anzahl Parameter (optional)
              </Label>
              <Input
                id="c-params"
                type="number"
                min="0"
                value={classify.parametersCount}
                onChange={(e) =>
                  setClassify({ ...classify, parametersCount: parseInt(e.target.value) || 0 })
                }
                className="h-8"
              />
            </div>
          </div>

          {classifyResult.status === "done" && classifyResult.data && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium">Begruendung:</p>
              <p className="text-sm text-muted-foreground">{classifyResult.data.reasoning}</p>
              {classifyResult.data.triggers.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {classifyResult.data.triggers.map((t, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
          {classifyResult.status === "error" && (
            <div className="border-t pt-3 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{classifyResult.error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Obligations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">
                  Art. 53 + Art. 55 Obligations-Check
                </CardTitle>
                <CardDescription>
                  Technical-Doc / Training-Summary / Copyright / Downstream-Info /
                  EU-Rep (non-EU) + Art. 55 wenn systemic.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {obligationsResult.status === "running" && (
                <Badge variant="outline">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Laeuft...
                </Badge>
              )}
              {obligationsResult.status === "done" && obligationsResult.data && (
                compliancePill(obligationsResult.data.isFullyCompliant)
              )}
              <Button
                size="sm"
                onClick={runObligations}
                disabled={obligationsResult.status === "running"}
              >
                Pruefen
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-2">
            {boolRow(
              "o-systemic",
              "Systemic Model (aus Classify Auto-Fill)",
              obligations.isSystemic,
              (v) => setObligations({ ...obligations, isSystemic: v }),
            )}
            {boolRow(
              "o-noneu",
              "Non-EU Provider (benoetigt EU-Representative)",
              obligations.isNonEuProvider,
              (v) => setObligations({ ...obligations, isNonEuProvider: v }),
            )}
            {boolRow(
              "o-copyright",
              "Art. 53 (1)(c) Copyright-Direktive eingehalten",
              obligations.respectsCopyrightDirective,
              (v) => setObligations({ ...obligations, respectsCopyrightDirective: v }),
            )}
            {boolRow(
              "o-downstream",
              "Art. 53 Downstream-Provider-Info geteilt",
              obligations.downstreamProviderInfoShared,
              (v) => setObligations({ ...obligations, downstreamProviderInfoShared: v }),
            )}
            {boolRow(
              "o-evals",
              "Art. 55 (1)(a) Model-Evaluations durchgefuehrt",
              obligations.hasModelEvaluations,
              (v) => setObligations({ ...obligations, hasModelEvaluations: v }),
            )}
            {boolRow(
              "o-sysrisk",
              "Art. 55 (1)(b) Systemic-Risk-Assessment",
              obligations.hasSystemicRiskAssessment,
              (v) => setObligations({ ...obligations, hasSystemicRiskAssessment: v }),
            )}
          </div>

          {obligationsResult.status === "done" && obligationsResult.data && (
            <div className="border-t pt-3 space-y-3">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Art. 53 Standard ({obligationsResult.data.standardObligationsMet} erfuellt)</span>
                    <span className="font-medium">{obligationsResult.data.standardPercent}%</span>
                  </div>
                  <Progress value={obligationsResult.data.standardPercent} className="h-2" />
                </div>
                {obligationsResult.data.systemicPercent !== null && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>
                        Art. 55 Systemic ({obligationsResult.data.systemicObligationsMet} erfuellt)
                      </span>
                      <span className="font-medium">
                        {obligationsResult.data.systemicPercent}%
                      </span>
                    </div>
                    <Progress value={obligationsResult.data.systemicPercent} className="h-2" />
                  </div>
                )}
              </div>
              {obligationsResult.data.missing.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fehlende Pflichten:</p>
                  <div className="flex flex-wrap gap-1">
                    {obligationsResult.data.missing.map((m, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-xs bg-red-50 text-red-800 border-red-200"
                      >
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {obligationsResult.status === "error" && (
            <div className="border-t pt-3 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{obligationsResult.error}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
