"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Globe } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Tia } from "@grc/shared";

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-900",
  medium: "bg-yellow-100 text-yellow-900",
  high: "bg-red-100 text-red-900",
};

const LEGAL_BASIS_LABELS: Record<string, string> = {
  adequacy: "Adequacy Decision",
  sccs: "Standard Contractual Clauses",
  bcrs: "Binding Corporate Rules",
  derogation: "Derogation",
};

export default function TiaListPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <TiaListInner />
    </ModuleGate>
  );
}

function TiaListInner() {
  const t = useTranslations("dpms");
  const router = useRouter();
  const [items, setItems] = useState<Tia[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (riskFilter) params.set("riskRating", riskFilter);
      if (countryFilter) params.set("transferCountry", countryFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/v1/dpms/tia?${params}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [riskFilter, countryFilter, search]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Extract unique countries for filter
  const countries = [...new Set(items.map((i) => i.transferCountry))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("tia.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("tia.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => router.push("/dpms/tia/new")}>
          <Plus size={14} className="mr-1" />
          {t("tia.create")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder={t("tia.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("tia.allRisks")}</option>
          <option value="low">{t("tia.riskRating.low")}</option>
          <option value="medium">{t("tia.riskRating.medium")}</option>
          <option value="high">{t("tia.riskRating.high")}</option>
        </select>
        {countries.length > 0 && (
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">{t("tia.allCountries")}</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{t("tia.empty")}</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("tia.titleField")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("tia.country")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("tia.legalBasis")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("tia.riskRatingLabel")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("tia.nextReview")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/dpms/tia/${item.id}`)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Globe size={12} className="text-gray-400" />
                      <span>{item.transferCountry}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {LEGAL_BASIS_LABELS[item.legalBasis] ?? item.legalBasis}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs ${RISK_COLORS[item.riskRating] ?? ""}`}>
                      {item.riskRating}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.nextReviewDate ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
