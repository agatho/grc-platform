"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface EmissionEntry {
  id: string;
  category: string;
  activityData: number;
  activityUnit: string;
  emissionFactor: number;
  emissionFactorUnit: string;
  co2e: number;
  source?: string;
  periodStart: string;
  periodEnd: string;
}

interface EmissionsData {
  scope1: EmissionEntry[];
  scope2Location: EmissionEntry[];
  scope2Market: EmissionEntry[];
  scope3: EmissionEntry[];
  summary: {
    scope1Total: number;
    scope2Total: number;
    scope3Total: number;
    previousYear?: {
      scope1Total: number;
      scope2Total: number;
      scope3Total: number;
    };
  };
}

type ScopeTab = "scope1" | "scope2" | "scope3";

export default function EmissionsPage() {
  return (
    <ModuleGate moduleKey="esg">
      <ModuleTabNav />
      <EmissionsInner />
    </ModuleGate>
  );
}

function EmissionsInner() {
  const t = useTranslations("esg");
  const [data, setData] = useState<EmissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ScopeTab>("scope1");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/esg/emissions");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const tabs: { key: ScopeTab; label: string }[] = [
    { key: "scope1", label: t("emissions.tabs.scope1") },
    { key: "scope2", label: t("emissions.tabs.scope2") },
    { key: "scope3", label: t("emissions.tabs.scope3") },
  ];

  const getEntries = (): EmissionEntry[] => {
    if (!data) return [];
    switch (activeTab) {
      case "scope1":
        return data.scope1;
      case "scope2":
        return [...(data.scope2Location ?? []), ...(data.scope2Market ?? [])];
      case "scope3":
        return data.scope3;
    }
  };

  const entries = getEntries();

  // Chart data for comparison
  const comparisonData = [
    {
      name: t("scopes.scope1"),
      current: data?.summary.scope1Total ?? 0,
      previous: data?.summary.previousYear?.scope1Total ?? 0,
    },
    {
      name: t("scopes.scope2Location"),
      current: data?.summary.scope2Total ?? 0,
      previous: data?.summary.previousYear?.scope2Total ?? 0,
    },
    {
      name: t("scopes.scope3"),
      current: data?.summary.scope3Total ?? 0,
      previous: data?.summary.previousYear?.scope3Total ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("emissions.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("emissions.subtitle")}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <ScopeCard
          label={t("emissions.scope1")}
          value={data?.summary.scope1Total ?? 0}
          color="border-red-200"
        />
        <ScopeCard
          label={t("emissions.scope2Location")}
          value={data?.summary.scope2Total ?? 0}
          color="border-orange-200"
        />
        <ScopeCard
          label={t("emissions.scope3")}
          value={data?.summary.scope3Total ?? 0}
          color="border-yellow-200"
        />
      </div>

      {/* Comparison Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {t("emissions.comparison")}
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="current"
                fill="#2563eb"
                name={t("emissions.currentYear")}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="previous"
                fill="#93c5fd"
                name={t("emissions.previousYear")}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Data Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  {t("emissions.category")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                  {t("emissions.activityData")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                  {t("emissions.emissionFactor")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                  {t("emissions.totalCo2e")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  {t("period")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  {t("source")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {entry.category}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {entry.activityData.toLocaleString()} {entry.activityUnit}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {entry.emissionFactor} {entry.emissionFactorUnit}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {entry.co2e.toLocaleString()} t
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {entry.periodStart} - {entry.periodEnd}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {entry.source ?? "-"}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    {t("noData")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScopeCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-lg border ${color} bg-white p-4`}>
      <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">
        {value.toLocaleString()} t
      </p>
    </div>
  );
}
