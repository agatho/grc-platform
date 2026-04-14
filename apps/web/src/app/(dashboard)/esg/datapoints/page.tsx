"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw, Search, Link2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EsrsDatapointDefinition } from "@grc/shared";

interface DatapointRow extends EsrsDatapointDefinition {
  hasMetric?: boolean;
  metricId?: string;
}

export default function DatapointsPage() {
  return (
    <ModuleGate moduleKey="esg">
      <ModuleTabNav />
      <DatapointsInner />
    </ModuleGate>
  );
}

function DatapointsInner() {
  const t = useTranslations("esg");
  const [datapoints, setDatapoints] = useState<DatapointRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStandard, setFilterStandard] = useState("");
  const [filterMandatory, setFilterMandatory] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStandard) params.set("standard", filterStandard);
      if (filterMandatory) params.set("mandatory", "true");

      const res = await fetch(`/api/v1/esg/datapoints?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setDatapoints(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [search, filterStandard, filterMandatory]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Derive unique standards for filter
  const standards = [...new Set(datapoints.map((d) => d.esrsStandard))].sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("datapoints.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("datapoints.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-1.5 text-sm"
          />
        </div>
        <select
          value={filterStandard}
          onChange={(e) => setFilterStandard(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("allStandards")}</option>
          {standards.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={filterMandatory}
            onChange={(e) => setFilterMandatory(e.target.checked)}
            className="rounded border-gray-300"
          />
          {t("datapoints.onlyMandatory")}
        </label>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {loading && datapoints.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("datapoints.code")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("datapoints.datapointName")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("datapoints.standard")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("unit")}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">{t("datapoints.mandatory")}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">{t("datapoints.metricAssigned")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {datapoints.map((dp) => (
                  <tr key={dp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-700">{dp.datapointCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{dp.nameEn}</span>
                      <p className="text-xs text-gray-500 mt-0.5">{dp.disclosureRequirement}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px]">{dp.esrsStandard}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{dp.unit ?? "-"}</td>
                    <td className="px-4 py-3 text-center">
                      {dp.isMandatory ? (
                        <Badge className="bg-red-100 text-red-900 text-[10px]">{t("datapoints.mandatory")}</Badge>
                      ) : (
                        <span className="text-xs text-gray-400">{t("datapoints.optional")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {dp.hasMetric ? (
                        <Badge className="bg-green-100 text-green-900 text-[10px]">
                          <Link2 size={10} className="mr-1" />
                          {t("datapoints.metricAssigned")}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">{t("datapoints.noMetric")}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {datapoints.length === 0 && !loading && (
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
