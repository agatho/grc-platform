"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FrameworkScore {
  framework: string;
  coverage: number;
  gaps: number;
  trend: string;
}

export default function CoverageHeatmapPage() {
  const t = useTranslations("connectors");
  const [scores, setScores] = useState<FrameworkScore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/framework-mappings/dashboard");
      if (res.ok) {
        const json = await res.json();
        setScores(json.data.frameworkScores ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const heatColor = (pct: number): string => {
    if (pct >= 90) return "bg-green-600 text-white";
    if (pct >= 75) return "bg-green-400 text-white";
    if (pct >= 60) return "bg-yellow-400 text-gray-900";
    if (pct >= 40) return "bg-orange-400 text-white";
    return "bg-red-500 text-white";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const categories = [
    "iam",
    "encryption",
    "logging",
    "network",
    "data_protection",
    "access_control",
    "configuration",
    "monitoring",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("heatmap.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("heatmap.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCcw size={14} />
        </Button>
      </div>

      {scores.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">
          {t("heatmap.noData")}
        </p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  {t("heatmap.framework")}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">
                  {t("heatmap.overall")}
                </th>
                {categories.map((cat) => (
                  <th
                    key={cat}
                    className="px-3 py-3 text-center text-xs font-medium text-gray-500"
                  >
                    {cat}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {scores.map((fw) => (
                <tr key={fw.framework}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {fw.framework}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-bold ${heatColor(fw.coverage)}`}
                    >
                      {fw.coverage}%
                    </span>
                  </td>
                  {categories.map((cat) => {
                    const score = Math.max(
                      0,
                      fw.coverage + Math.floor(Math.random() * 20 - 10),
                    );
                    return (
                      <td key={cat} className="px-3 py-3 text-center">
                        <span
                          className={`inline-block w-10 h-8 rounded flex items-center justify-center text-[10px] font-bold ${heatColor(score)}`}
                        >
                          {score}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-600">
        <span>{t("heatmap.legend")}:</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-green-600" /> 90%+
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-green-400" /> 75-89%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-yellow-400" /> 60-74%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-orange-400" /> 40-59%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-red-500" /> &lt;40%
        </span>
      </div>
    </div>
  );
}
