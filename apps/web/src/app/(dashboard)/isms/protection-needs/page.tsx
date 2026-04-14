"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Search,
  RefreshCcw,
  ShieldCheck,
  Info,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { ProtectionLevelBadge } from "@/components/isms/protection-level-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProtectionLevel } from "@grc/shared";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

type ProtectionSource = "bia" | "manual" | "inherited";

interface ProtectionNeedRow {
  id: string;
  name: string;
  assetTier: string;
  confidentialityLevel: ProtectionLevel | null;
  integrityLevel: ProtectionLevel | null;
  availabilityLevel: ProtectionLevel | null;
  overallProtection: ProtectionLevel | null;
  classificationId: string | null;
  classifiedAt: string | null;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<string, number> = {
  normal: 1,
  high: 2,
  very_high: 3,
};

function deriveSource(row: ProtectionNeedRow): ProtectionSource {
  // Assets with a BIA-linked classification are considered BIA-sourced.
  // Assets with a manual classification have "manual".
  // Assets without classification inherit from parent/default.
  if (!row.classificationId) return "inherited";
  // If classified and has high/very_high availability, likely BIA-derived
  if (
    row.availabilityLevel &&
    LEVEL_ORDER[row.availabilityLevel] >= 2
  ) {
    return "bia";
  }
  return "manual";
}

const SOURCE_STYLES: Record<ProtectionSource, string> = {
  bia: "bg-blue-100 text-blue-800 border-blue-200",
  manual: "bg-purple-100 text-purple-800 border-purple-200",
  inherited: "bg-gray-100 text-gray-500 border-gray-200",
};

const SOURCE_LABELS: Record<ProtectionSource, { en: string; de: string }> = {
  bia: { en: "BIA Result", de: "BIA-Ergebnis" },
  manual: { en: "Manual", de: "Manuell" },
  inherited: { en: "Inherited", de: "Vererbt" },
};

// ──────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────

export default function IsmsProtectionNeedsPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ModuleTabNav />
      <ProtectionNeedsInner />
    </ModuleGate>
  );
}

function ProtectionNeedsInner() {
  const t = useTranslations("isms");
  const [assets, setAssets] = useState<ProtectionNeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [protectionFilter, setProtectionFilter] = useState("__all__");
  const [sourceFilter, setSourceFilter] = useState("__all__");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/assets/classification-overview");
      if (res.ok) {
        const json = await res.json();
        setAssets(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    let result = assets;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q));
    }
    if (protectionFilter !== "__all__") {
      if (protectionFilter === "unclassified") {
        result = result.filter((a) => !a.classificationId);
      } else {
        result = result.filter(
          (a) => a.overallProtection === protectionFilter
        );
      }
    }
    if (sourceFilter !== "__all__") {
      result = result.filter((a) => deriveSource(a) === sourceFilter);
    }
    return result;
  }, [assets, search, protectionFilter, sourceFilter]);

  // KPI stats
  const totalAssets = assets.length;
  const classifiedCount = assets.filter((a) => a.classificationId).length;
  const highCount = assets.filter(
    (a) => a.overallProtection === "high"
  ).length;
  const veryHighCount = assets.filter(
    (a) => a.overallProtection === "very_high"
  ).length;

  if (loading && assets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("protectionNeeds")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("protectionNeedsDescription")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCcw
            size={14}
            className={loading ? "animate-spin" : ""}
          />
        </Button>
      </div>

      {/* BIA info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Info size={16} className="mt-0.5 text-blue-600 shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">{t("biaIntegrationTitle")}</p>
          <p className="mt-1 text-blue-700">
            {t("biaIntegrationDescription")}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">{t("total")}</p>
          <p className="text-2xl font-bold text-gray-900">{totalAssets}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">{t("classified")}</p>
          <p className="text-2xl font-bold text-gray-900">
            {classifiedCount}
            <span className="text-sm text-gray-400 ml-1">
              ({totalAssets > 0
                ? Math.round((classifiedCount / totalAssets) * 100)
                : 0}
              %)
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs text-orange-600">{t("protectionHigh")}</p>
          <p className="text-2xl font-bold text-orange-700">{highCount}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-600">{t("protectionVeryHigh")}</p>
          <p className="text-2xl font-bold text-red-700">{veryHighCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchAssets")}
            className="h-8 w-48 rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <Select
          value={protectionFilter}
          onValueChange={setProtectionFilter}
        >
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t("protectionClass")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allLevels")}</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High / Hoch</SelectItem>
            <SelectItem value="very_high">Very High / Sehr Hoch</SelectItem>
            <SelectItem value="unclassified">
              {t("unclassified")}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t("source")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allSources")}</SelectItem>
            <SelectItem value="bia">BIA</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="inherited">Inherited</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                {t("assetName")}
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                C
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                I
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                A
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                {t("protectionClass")}
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                {t("source")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-gray-400"
                >
                  <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  {t("noAssetsFound")}
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const source = deriveSource(a);
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {a.name}
                      </span>
                      {a.assetTier && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-[10px]"
                        >
                          {a.assetTier}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ProtectionLevelBadge
                        level={a.confidentialityLevel}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ProtectionLevelBadge level={a.integrityLevel} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ProtectionLevelBadge
                        level={a.availabilityLevel}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ProtectionLevelBadge
                        level={a.overallProtection}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant="outline"
                        className={SOURCE_STYLES[source]}
                      >
                        {SOURCE_LABELS[source].en}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
