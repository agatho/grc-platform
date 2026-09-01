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

/**
 * [ARCTOS-FULL-2026-08-31 / WP12 · S14-01] Per-category coverage, as measured.
 *
 * `categoryCoverageMeasured === false` means no snapshot has ever recorded a
 * category breakdown — which is a different statement from "coverage is 0"
 * and must not be rendered as a traffic light.
 */
interface HeatmapResponse {
  frameworkScores: FrameworkScore[];
  categoryCoverage: Record<string, Record<string, number>>;
  categoryCoverageMeasured: boolean;
  categoryCoverageAsOf: string | null;
}

export default function CoverageHeatmapPage() {
  const t = useTranslations("connectors");
  const [scores, setScores] = useState<FrameworkScore[]>([]);
  const [categoryCoverage, setCategoryCoverage] = useState<
    Record<string, Record<string, number>>
  >({});
  const [categoriesMeasured, setCategoriesMeasured] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/framework-mappings/dashboard");
      if (res.ok) {
        const json: { data: HeatmapResponse } = await res.json();
        setScores(json.data.frameworkScores ?? []);
        setCategoryCoverage(json.data.categoryCoverage ?? {});
        setCategoriesMeasured(Boolean(json.data.categoryCoverageMeasured));
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

  // S14-01: the category axis used to be a hardcoded list of eight labels
  // that no measurement ever referred to. It is derived from the snapshot now,
  // so an unmeasured installation shows no columns rather than eight fake ones.
  const categories = Array.from(
    new Set(
      Object.values(categoryCoverage).flatMap((byCat) => Object.keys(byCat)),
    ),
  ).sort();

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

      {/* S14-01: the absence of a measurement is stated, not hidden behind
          plausible-looking colours. */}
      {!categoriesMeasured && (
        <div
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
        >
          {t("heatmap.categoryNotMeasured")}
        </div>
      )}

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
                    scope="col"
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
                  {/* [WP12 · S14-01] This was
                        `fw.coverage + Math.floor(Math.random() * 20 - 10)` —
                        a new number on every render, shown as a traffic light
                        with a percentage. Only measured values are rendered
                        now; an unmeasured cell stays empty and says so. */}
                  {categories.map((cat) => {
                    const score = categoryCoverage[fw.framework]?.[cat];
                    if (typeof score !== "number") {
                      return (
                        <td
                          key={cat}
                          className="px-3 py-3 text-center text-[10px] text-gray-500"
                          title={t("heatmap.categoryNotMeasured")}
                        >
                          &ndash;
                        </td>
                      );
                    }
                    return (
                      <td key={cat} className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex w-10 h-8 rounded items-center justify-center text-[10px] font-bold ${heatColor(score)}`}
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
