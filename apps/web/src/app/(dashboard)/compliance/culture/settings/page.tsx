"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import type { CCIFactorKey, CCIFactorWeights } from "@grc/shared";
import {
  DEFAULT_CCI_WEIGHTS,
  CCI_FACTOR_KEYS,
  calculateWeightedCCI,
} from "@grc/shared";

const FACTOR_LABELS: Record<CCIFactorKey, string> = {
  task_compliance: "Task Compliance",
  policy_ack_rate: "Policy Acknowledgment Rate",
  training_completion: "Training Completion",
  incident_response_time: "Incident Response Time",
  audit_finding_closure: "Audit Finding Closure",
  self_assessment_participation: "Self-Assessment Participation",
};

const SAMPLE_SCORES: Record<CCIFactorKey, number> = {
  task_compliance: 80,
  policy_ack_rate: 70,
  training_completion: 90,
  incident_response_time: 60,
  audit_finding_closure: 75,
  self_assessment_participation: 85,
};

export default function CCIConfigPage() {
  const t = useTranslations("cci");
  const [weights, setWeights] = useState<CCIFactorWeights>({
    ...DEFAULT_CCI_WEIGHTS,
  });
  const [originalWeights, setOriginalWeights] = useState<CCIFactorWeights>({
    ...DEFAULT_CCI_WEIGHTS,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/v1/compliance/cci/configuration");
        if (res.ok) {
          const data = await res.json();
          const w = data.data?.factorWeights ?? DEFAULT_CCI_WEIGHTS;
          setWeights(w);
          setOriginalWeights(w);
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const weightSum = useMemo(() => {
    return Object.values(weights).reduce((a, b) => a + b, 0);
  }, [weights]);

  const isValid = useMemo(() => {
    return Math.abs(weightSum - 1.0) < 0.001;
  }, [weightSum]);

  const previewScore = useMemo(() => {
    return calculateWeightedCCI(SAMPLE_SCORES, weights);
  }, [weights]);

  const hasChanges = useMemo(() => {
    return CCI_FACTOR_KEYS.some((key) => weights[key] !== originalWeights[key]);
  }, [weights, originalWeights]);

  const handleWeightChange = useCallback(
    (key: CCIFactorKey, value: number[]) => {
      setWeights((prev) => ({ ...prev, [key]: value[0] / 100 }));
      setSuccess(false);
      setError(null);
    },
    [],
  );

  const handleRestore = useCallback(() => {
    setWeights({ ...DEFAULT_CCI_WEIGHTS });
    setSuccess(false);
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/v1/compliance/cci/configuration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorWeights: weights }),
      });

      if (res.ok) {
        setOriginalWeights({ ...weights });
        setSuccess(true);
      } else {
        const data = await res.json();
        setError(data.error ?? t("saveFailed"));
      }
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [weights, isValid, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/compliance/culture">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("configTitle")}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {t("configDescription")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleRestore}>
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("restoreDefaults")}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isValid || !hasChanges || saving}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t("save")}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          {t("saveSuccess")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Weight Sliders */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("factorWeights")}</CardTitle>
              <CardDescription>{t("factorWeightsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {CCI_FACTOR_KEYS.map((key) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{FACTOR_LABELS[key]}</Label>
                    <span className="text-sm font-medium text-gray-600">
                      {(weights[key] * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[weights[key] * 100]}
                    onValueChange={(v) => handleWeightChange(key, v)}
                    max={100}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                </div>
              ))}

              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <span className="text-sm font-medium text-gray-700">
                  {t("totalWeight")}
                </span>
                <Badge
                  className={
                    isValid
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }
                >
                  {(weightSum * 100).toFixed(0)}%
                  {isValid ? "" : ` (${t("mustEqual100")})`}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>{t("livePreview")}</CardTitle>
              <CardDescription>{t("livePreviewDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <span className="text-4xl font-bold text-blue-600">
                  {previewScore.toFixed(1)}
                </span>
                <span className="text-sm text-gray-500">
                  {t("previewScore")}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {CCI_FACTOR_KEYS.map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-600">{FACTOR_LABELS[key]}</span>
                    <span className="font-medium">
                      {SAMPLE_SCORES[key]} x {(weights[key] * 100).toFixed(0)}%
                      = {(SAMPLE_SCORES[key] * weights[key]).toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
