"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GapAnalysis {
  id: string;
  framework: string;
  analysisDate: string;
  totalControls: number;
  coveredControls: number;
  partiallyCoveredControls: number;
  notCoveredControls: number;
  coveragePercentage: number;
  riskExposure: string | null;
}

const FRAMEWORKS = [
  "ISO27001",
  "NIS2",
  "BSI",
  "NIST_CSF",
  "SOC2",
  "TISAX",
  "DORA",
  "GDPR",
  "COBIT",
  "CIS",
];

export default function GapAnalysisPage() {
  const t = useTranslations("connectors");
  const [analyses, setAnalyses] = useState<GapAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/v1/framework-mappings/gap-analysis?limit=50",
      );
      if (res.ok) {
        const json = await res.json();
        setAnalyses(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const runAnalysis = async (framework: string) => {
    setRunning(framework);
    try {
      const res = await fetch("/api/v1/framework-mappings/gap-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ framework }),
      });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setRunning(null);
    }
  };

  const riskColor: Record<string, string> = {
    critical: "bg-red-100 text-red-900",
    high: "bg-orange-100 text-orange-900",
    medium: "bg-yellow-100 text-yellow-900",
    low: "bg-green-100 text-green-900",
  };

  if (loading && analyses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("gapAnalysis.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("gapAnalysis.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Run Analysis Buttons */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          {t("gapAnalysis.runForFramework")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {FRAMEWORKS.map((fw) => (
            <Button
              key={fw}
              variant="outline"
              size="sm"
              onClick={() => runAnalysis(fw)}
              disabled={running === fw}
            >
              {running === fw ? (
                <Loader2 size={14} className="animate-spin mr-1" />
              ) : (
                <Play size={14} className="mr-1" />
              )}
              {fw}
            </Button>
          ))}
        </div>
      </div>

      {/* Analysis Results */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {t("gapAnalysis.results")}
          </h2>
        </div>
        {analyses.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">
            {t("gapAnalysis.noResults")}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {analyses.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {a.framework}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(a.analysisDate).toLocaleDateString()} -{" "}
                    {a.totalControls} {t("gapAnalysis.controls")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-900">
                    {Number(a.coveragePercentage).toFixed(0)}%
                  </span>
                  <span className="text-xs text-green-600">
                    {a.coveredControls} {t("gapAnalysis.covered")}
                  </span>
                  {a.notCoveredControls > 0 && (
                    <span className="text-xs text-red-600">
                      {a.notCoveredControls} {t("gapAnalysis.missing")}
                    </span>
                  )}
                  {a.riskExposure && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${riskColor[a.riskExposure] ?? ""}`}
                    >
                      {a.riskExposure}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
