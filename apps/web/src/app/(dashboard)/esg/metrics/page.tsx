"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw, Search, Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EsrsMetric } from "@grc/shared";

interface MetricRow extends EsrsMetric {
  datapointCode?: string;
  lastValue?: number;
  lastQuality?: string;
  responsibleName?: string;
}

export default function MetricsPage() {
  return (
    <ModuleGate moduleKey="esg">
      <MetricsInner />
    </ModuleGate>
  );
}

function MetricsInner() {
  const t = useTranslations("esg");
  const router = useRouter();
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/v1/esg/metrics?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setMetrics(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("metrics.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("metrics.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm">
            <Plus size={14} className="mr-1" />
            {t("metrics.create")}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-1.5 text-sm"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {loading && metrics.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("name")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("metrics.datapoint")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("frequency")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("responsible")}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("lastMeasurement")}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">{t("metrics.dataQuality")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {metrics.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/esg/metrics/${m.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-600">{m.datapointCode ?? m.datapointId.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{m.frequency.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-gray-600">{m.responsibleName ?? "-"}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {m.lastValue != null ? `${m.lastValue} ${m.unit}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {m.lastQuality ? (
                        <QualityBadge quality={m.lastQuality} t={t} />
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {metrics.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t("empty")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function QualityBadge({ quality, t }: { quality: string; t: (key: string) => string }) {
  const colors: Record<string, string> = {
    measured: "bg-green-100 text-green-700",
    estimated: "bg-yellow-100 text-yellow-700",
    calculated: "bg-blue-100 text-blue-700",
  };
  return (
    <Badge variant="outline" className={`${colors[quality] ?? ""} text-[10px]`}>
      {t(`quality.${quality}`)}
    </Badge>
  );
}
