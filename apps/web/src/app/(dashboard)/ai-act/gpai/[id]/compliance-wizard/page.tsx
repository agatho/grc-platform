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
import { useTranslations } from "next-intl";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Der Assistent war Mischtext aus
 * beiden Sprachen — "Beide Checks ausfuehren" neben "High-Impact Capabilities
 * (Benchmarks)". `tierBadge` und `compliancePill` stehen ausserhalb der
 * Komponente und koennen keinen Hook lesen; sie nehmen die
 * Uebersetzungsfunktion jetzt als Parameter.
 */

/** Die Uebersetzungsfunktion, wie sie die beiden Hilfsfunktionen brauchen. */
type Translate = (key: string) => string;
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

function tierBadge(
  tier: "systemic" | "high_capability" | "standard",
  t: Translate,
) {
  if (tier === "systemic") {
    return (
      <Badge
        variant="outline"
        className="bg-red-100 text-red-800 border-red-300"
      >
        <ShieldAlert className="h-3 w-3 mr-1" />
        {t("gpaiWizard.tier.systemic")}
      </Badge>
    );
  }
  if (tier === "high_capability") {
    return (
      <Badge
        variant="outline"
        className="bg-amber-100 text-amber-800 border-amber-300"
      >
        {t("gpaiWizard.tier.high_capability")}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-sky-100 text-sky-800 border-sky-300">
      {t("gpaiWizard.tier.standard")}
    </Badge>
  );
}

function compliancePill(ok: boolean, t: Translate) {
  return ok ? (
    <Badge
      variant="outline"
      className="bg-emerald-100 text-emerald-800 border-emerald-300"
    >
      <CheckCircle2 className="h-3 w-3 mr-1" />
      {t("gpaiWizard.compliant")}
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
      <XCircle className="h-3 w-3 mr-1" />
      {t("gpaiWizard.gaps")}
    </Badge>
  );
}

export default function GpaiComplianceWizardPage() {
  const t = useTranslations("aiAct");
  const tCommon = useTranslations("common");
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
  const [classifyResult, setClassifyResult] = useState<ClassifyResult>({
    status: "idle",
  });

  // ─── Obligations inputs ──────────────────────────────────
  const [obligations, setObligations] = useState({
    respectsCopyrightDirective: false,
    downstreamProviderInfoShared: false,
    isNonEuProvider: false,
    isSystemic: false,
    hasModelEvaluations: false,
    hasSystemicRiskAssessment: false,
  });
  const [obligationsResult, setObligationsResult] = useState<ObligationsResult>(
    {
      status: "idle",
    },
  );

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
        error: e instanceof Error ? e.message : tCommon("common.error"),
      });
    }
  }, [id, classify, tCommon]);

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
        error: e instanceof Error ? e.message : tCommon("common.error"),
      });
    }
  }, [id, obligations, tCommon]);

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
            {t("gpaiWizard.backToModels")}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("gpaiWizard.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("gpaiWizard.description")}
          </p>
        </div>
        <Button onClick={runAll}>
          <FileCheck className="h-4 w-4 mr-2" />
          {t("gpaiWizard.runBoth")}
        </Button>
      </div>

      {/* Section 1: Classify Systemic Risk */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">
                  {t("gpaiWizard.classifyTitle")}
                </CardTitle>
                <CardDescription>
                  {t("gpaiWizard.classifyDescription")}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {classifyResult.status === "running" && (
                <Badge variant="outline">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {t("gpaiWizard.running")}
                </Badge>
              )}
              {classifyResult.status === "done" &&
                classifyResult.data &&
                tierBadge(classifyResult.data.tierLevel, t)}
              {classifyResult.status === "error" && (
                <Badge
                  variant="outline"
                  className="bg-red-100 text-red-800 border-red-300"
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  {tCommon("common.error")}
                </Badge>
              )}
              <Button
                size="sm"
                onClick={runClassify}
                disabled={classifyResult.status === "running"}
              >
                {t("gpaiWizard.classifyAction")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label htmlFor="c-flops" className="text-xs">
                {t("gpaiWizard.flopsLabel")}
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
              t("gpaiWizard.flag.designated"),
              classify.commissionDesignated,
              (v) => setClassify({ ...classify, commissionDesignated: v }),
            )}
            {boolRow(
              "c-highimpact",
              t("gpaiWizard.flag.highImpact"),
              classify.hasHighImpactCapabilities,
              (v) => setClassify({ ...classify, hasHighImpactCapabilities: v }),
            )}
            {boolRow(
              "c-reasoning",
              t("gpaiWizard.flag.advancedReasoning"),
              classify.hasAdvancedReasoning,
              (v) => setClassify({ ...classify, hasAdvancedReasoning: v }),
            )}
            {boolRow(
              "c-multimodal",
              t("gpaiWizard.flag.multimodal"),
              classify.hasMultimodalCapabilities,
              (v) => setClassify({ ...classify, hasMultimodalCapabilities: v }),
            )}
            <div className="col-span-2">
              <Label htmlFor="c-params" className="text-xs">
                {t("gpaiWizard.parametersLabel")}
              </Label>
              <Input
                id="c-params"
                type="number"
                min="0"
                value={classify.parametersCount}
                onChange={(e) =>
                  setClassify({
                    ...classify,
                    parametersCount: parseInt(e.target.value) || 0,
                  })
                }
                className="h-8"
              />
            </div>
          </div>

          {classifyResult.status === "done" && classifyResult.data && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-sm font-medium">{t("gpaiWizard.reasoning")}</p>
              <p className="text-sm text-muted-foreground">
                {classifyResult.data.reasoning}
              </p>
              {classifyResult.data.triggers.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {classifyResult.data.triggers.map((trigger, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {trigger}
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
                  {t("gpaiWizard.obligationsTitle")}
                </CardTitle>
                <CardDescription>
                  {t("gpaiWizard.obligationsDescription")}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {obligationsResult.status === "running" && (
                <Badge variant="outline">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {t("gpaiWizard.running")}
                </Badge>
              )}
              {obligationsResult.status === "done" &&
                obligationsResult.data &&
                compliancePill(obligationsResult.data.isFullyCompliant, t)}
              <Button
                size="sm"
                onClick={runObligations}
                disabled={obligationsResult.status === "running"}
              >
                {t("gpaiWizard.checkAction")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-2">
            {boolRow(
              "o-systemic",
              t("gpaiWizard.flag.systemicModel"),
              obligations.isSystemic,
              (v) => setObligations({ ...obligations, isSystemic: v }),
            )}
            {boolRow(
              "o-noneu",
              t("gpaiWizard.flag.nonEuProvider"),
              obligations.isNonEuProvider,
              (v) => setObligations({ ...obligations, isNonEuProvider: v }),
            )}
            {boolRow(
              "o-copyright",
              t("gpaiWizard.flag.copyright"),
              obligations.respectsCopyrightDirective,
              (v) =>
                setObligations({
                  ...obligations,
                  respectsCopyrightDirective: v,
                }),
            )}
            {boolRow(
              "o-downstream",
              t("gpaiWizard.flag.downstream"),
              obligations.downstreamProviderInfoShared,
              (v) =>
                setObligations({
                  ...obligations,
                  downstreamProviderInfoShared: v,
                }),
            )}
            {boolRow(
              "o-evals",
              t("gpaiWizard.flag.modelEvaluations"),
              obligations.hasModelEvaluations,
              (v) => setObligations({ ...obligations, hasModelEvaluations: v }),
            )}
            {boolRow(
              "o-sysrisk",
              t("gpaiWizard.flag.systemicRiskAssessment"),
              obligations.hasSystemicRiskAssessment,
              (v) =>
                setObligations({
                  ...obligations,
                  hasSystemicRiskAssessment: v,
                }),
            )}
          </div>

          {obligationsResult.status === "done" && obligationsResult.data && (
            <div className="border-t pt-3 space-y-3">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>
                      {t("gpaiWizard.standardProgress", {
                        met: obligationsResult.data.standardObligationsMet,
                      })}
                    </span>
                    <span className="font-medium">
                      {obligationsResult.data.standardPercent}%
                    </span>
                  </div>
                  <Progress
                    value={obligationsResult.data.standardPercent}
                    className="h-2"
                  />
                </div>
                {obligationsResult.data.systemicPercent !== null && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>
                        {t("gpaiWizard.systemicProgress", {
                          met: obligationsResult.data.systemicObligationsMet,
                        })}
                      </span>
                      <span className="font-medium">
                        {obligationsResult.data.systemicPercent}%
                      </span>
                    </div>
                    <Progress
                      value={obligationsResult.data.systemicPercent}
                      className="h-2"
                    />
                  </div>
                )}
              </div>
              {obligationsResult.data.missing.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("gpaiWizard.missingObligations")}
                  </p>
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
