"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  ArrowLeft,
  Filter,
  DollarSign,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  GrcCostEntry,
  GrcArea,
  CostCategory,
  CostType,
} from "@grc/shared";

const GRC_AREAS: GrcArea[] = [
  "erm", "isms", "ics", "dpms", "audit", "tprm", "bcms", "esg", "general",
];
const COST_CATEGORIES: CostCategory[] = [
  "personnel", "external", "tools", "training", "measures", "certification",
];
const COST_TYPES: CostType[] = ["planned", "actual", "forecast"];

export default function CostListPage() {
  const t = useTranslations("budget");
  const router = useRouter();
  const [costs, setCosts] = useState<(GrcCostEntry & { grcArea?: GrcArea })[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterArea, setFilterArea] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterArea) params.set("area", filterArea);
      if (filterCategory) params.set("category", filterCategory);
      if (filterType) params.set("type", filterType);

      const res = await fetch(`/api/v1/budget/costs?${params}`);
      if (res.ok) {
        const json = await res.json();
        setCosts(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filterArea, filterCategory, filterType]);

  useEffect(() => {
    void fetchCosts();
  }, [fetchCosts]);

  const totalPages = Math.ceil(total / 20);

  const typeColors: Record<CostType, string> = {
    planned: "bg-blue-100 text-blue-700",
    actual: "bg-green-100 text-green-700",
    forecast: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/budget")}>
            <ArrowLeft size={14} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("costs.title")}</h1>
            <p className="text-sm text-gray-500 mt-1">{t("costs.subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={14} className="mr-1" />
            {t("costs.filters")}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchCosts} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t("costs.area")}</label>
              <select
                value={filterArea}
                onChange={(e) => { setFilterArea(e.target.value); setPage(1); }}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">{t("costs.allAreas")}</option>
                {GRC_AREAS.map((a) => (
                  <option key={a} value={a}>{t(`areas.${a}`)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t("costs.category")}</label>
              <select
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">{t("costs.allCategories")}</option>
                {COST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(`categories.${c}`)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t("costs.type")}</label>
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">{t("costs.allTypes")}</option>
                {COST_TYPES.map((ct) => (
                  <option key={ct} value={ct}>{t(`costs.typeLabels.${ct}`)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Cost Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {loading && costs.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : costs.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p className="text-sm text-gray-400">{t("costs.noCosts")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("costs.date")}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("costs.entityType")}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("costs.category")}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("costs.type")}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("costs.amount")}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("costs.department")}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("costs.description")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {costs.map((cost) => (
                    <tr key={cost.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {cost.periodStart}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px]">
                          {cost.entityType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {t(`categories.${cost.costCategory}`)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`${typeColors[cost.costType]} text-[10px]`}>
                          {t(`costs.typeLabels.${cost.costType}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {Number(cost.amount).toLocaleString("de-DE", { minimumFractionDigits: 2 })} {cost.currency}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{cost.department ?? "-"}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{cost.description ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <span className="text-xs text-gray-500">
                  {total} {t("costs.title").toLowerCase()}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    &laquo;
                  </Button>
                  <span className="px-3 py-1 text-sm text-gray-700">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    &raquo;
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
