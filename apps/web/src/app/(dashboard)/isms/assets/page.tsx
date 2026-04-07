"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Search, RefreshCcw, Shield } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
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
import type { ProtectionLevel, AssetTier } from "@grc/shared";

interface AssetRow {
  id: string;
  name: string;
  assetTier: AssetTier;
  description?: string;
  classificationId: string | null;
  confidentialityLevel: ProtectionLevel | null;
  integrityLevel: ProtectionLevel | null;
  availabilityLevel: ProtectionLevel | null;
  overallProtection: ProtectionLevel | null;
  classifiedAt: string | null;
  reviewDate: string | null;
}

export default function IsmsAssetsPage() {
  return (
    <ModuleGate moduleKey="isms">
      <IsmsAssetsInner />
    </ModuleGate>
  );
}

function IsmsAssetsInner() {
  const t = useTranslations("isms");
  const router = useRouter();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [protectionFilter, setProtectionFilter] = useState("__all__");
  const [tierFilter, setTierFilter] = useState("__all__");

  const fetchAssets = useCallback(async () => {
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
    void fetchAssets();
  }, [fetchAssets]);

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
        result = result.filter((a) => a.overallProtection === protectionFilter);
      }
    }
    if (tierFilter !== "__all__") {
      result = result.filter((a) => a.assetTier === tierFilter);
    }
    return result;
  }, [assets, search, protectionFilter, tierFilter]);

  // KPI stats
  const totalAssets = assets.length;
  const classifiedCount = assets.filter((a) => a.classificationId).length;
  const highCount = assets.filter((a) => a.overallProtection === "high").length;
  const veryHighCount = assets.filter((a) => a.overallProtection === "very_high").length;

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
          <h1 className="text-2xl font-bold text-gray-900">{t("assets")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("classification")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAssets} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
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
              ({totalAssets > 0 ? Math.round((classifiedCount / totalAssets) * 100) : 0}%)
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs text-orange-600">{t("protectionLevels.high")}</p>
          <p className="text-2xl font-bold text-orange-700">{highCount}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-600">{t("protectionLevels.very_high")}</p>
          <p className="text-2xl font-bold text-red-700">{veryHighCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchAssets")}
            className="h-8 w-48 rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <Select value={protectionFilter} onValueChange={setProtectionFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder={t("overallProtection")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allLevels")}</SelectItem>
            <SelectItem value="normal">{t("protectionLevels.normal")}</SelectItem>
            <SelectItem value="high">{t("protectionLevels.high")}</SelectItem>
            <SelectItem value="very_high">{t("protectionLevels.very_high")}</SelectItem>
            <SelectItem value="unclassified">{t("unclassified")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Asset Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Tiers</SelectItem>
            <SelectItem value="business_structure">Business Structure</SelectItem>
            <SelectItem value="primary_asset">Primary Asset</SelectItem>
            <SelectItem value="supporting_asset">Supporting Asset</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("assetName")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tier</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">C</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">I</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">A</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">{t("overallProtection")}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  {t("noAssets")}
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr
                  key={a.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => window.location.href = `/isms/assets/${a.id}`}
                >
                  <td className="px-4 py-3">
                    <Link href={`/isms/assets/${a.id}`} className="font-medium text-blue-700 hover:text-blue-900 hover:underline">
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px]">{a.assetTier}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ProtectionLevelBadge level={a.confidentialityLevel} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ProtectionLevelBadge level={a.integrityLevel} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ProtectionLevelBadge level={a.availabilityLevel} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ProtectionLevelBadge level={a.overallProtection} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/isms/assets/${a.id}/classify`}>
                      <Button variant="outline" size="sm">
                        {t("classify")}
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
