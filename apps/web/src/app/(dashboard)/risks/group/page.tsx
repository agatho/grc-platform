"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Building2,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  Inbox,
  ExternalLink,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgRiskSummary {
  orgId: string;
  orgName: string;
  orgCode: string | null;
  totalRisks: number;
  criticalCount: number;
  appetiteExceededCount: number;
  avgScore: number;
  maxScore: number;
  kriRedCount: number;
}

// ---------------------------------------------------------------------------
// Compact Heat Map (simplified)
// ---------------------------------------------------------------------------

function CompactHeatMap({ data }: { data: OrgRiskSummary[] }) {
  // Simplified consolidated view: bubble chart by avgScore and totalRisks
  const maxRisks = Math.max(1, ...data.map((d) => d.totalRisks));

  return (
    <div className="relative h-[180px] w-full rounded-lg bg-gradient-to-br from-green-50 via-yellow-50 to-red-50 border border-gray-200 p-4">
      {data.map((org) => {
        // Place org based on avgScore (x-axis) and totalRisks (y-axis)
        const xPercent = Math.min(90, Math.max(5, (org.avgScore / 25) * 100));
        const yPercent = Math.min(
          85,
          Math.max(10, (1 - org.totalRisks / maxRisks) * 100),
        );
        const radius = Math.max(
          16,
          Math.min(36, 16 + (org.totalRisks / maxRisks) * 20),
        );

        const bgColor =
          org.avgScore >= 15
            ? "bg-red-400"
            : org.avgScore >= 10
              ? "bg-orange-400"
              : org.avgScore >= 5
                ? "bg-yellow-400"
                : "bg-green-400";

        return (
          <div
            key={org.orgId}
            className={`absolute rounded-full ${bgColor} text-white text-[9px] font-bold flex items-center justify-center shadow-sm opacity-80 hover:opacity-100 transition-opacity cursor-default`}
            style={{
              left: `${xPercent}%`,
              top: `${yPercent}%`,
              width: radius,
              height: radius,
              transform: "translate(-50%, -50%)",
            }}
            title={`${org.orgName}: ${org.totalRisks} risks, avg ${org.avgScore}`}
          >
            {org.orgCode?.slice(0, 3) ?? org.orgName.slice(0, 2)}
          </div>
        );
      })}
      <div className="absolute bottom-1 right-2 text-[9px] text-gray-400">
        Avg Score &rarr;
      </div>
      <div className="absolute top-1 left-1 text-[9px] text-gray-400">
        &uarr; Risk Count
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function GroupRiskContent() {
  const t = useTranslations("risk.group");
  const router = useRouter();

  const [data, setData] = useState<OrgRiskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Org filter checkboxes
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/risks/group-summary");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const items: OrgRiskSummary[] = json.data ?? [];
      setData(items);
      setSelectedOrgs(new Set(items.map((d) => d.orgId)));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Filtered data
  const filteredData = data.filter((d) => selectedOrgs.has(d.orgId));

  // Totals
  const totalRisks = filteredData.reduce((s, d) => s + d.totalRisks, 0);
  const totalCritical = filteredData.reduce((s, d) => s + d.criticalCount, 0);
  const totalAppetiteExceeded = filteredData.reduce(
    (s, d) => s + d.appetiteExceededCount,
    0,
  );
  const totalRedKris = filteredData.reduce((s, d) => s + d.kriRedCount, 0);

  function toggleOrg(orgId: string) {
    setSelectedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <ShieldAlert size={48} className="mb-4" />
        <p className="text-lg font-medium">{t("noData")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
      </div>

      {/* ── Summary cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">{t("totalAcross")}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {totalRisks}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">{t("criticalCount")}</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">
              {totalCritical}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">{t("appetiteExceeded")}</p>
            <p className="text-3xl font-bold text-red-600 mt-1">
              {totalAppetiteExceeded}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-500">{t("redKris")}</p>
            <p className="text-3xl font-bold text-red-500 mt-1">
              {totalRedKris}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Org filter checkboxes ──────────────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          {t("filterOrgs")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {data.map((d) => (
            <label
              key={d.orgId}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                selectedOrgs.has(d.orgId)
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-400"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedOrgs.has(d.orgId)}
                onChange={() => toggleOrg(d.orgId)}
                className="sr-only"
              />
              <Building2 size={14} />
              {d.orgName}
              {d.orgCode && (
                <span className="text-xs font-mono opacity-70">
                  ({d.orgCode})
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* ── Consolidated heat map ──────────────────────────────── */}
      {filteredData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("consolidated")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CompactHeatMap data={filteredData} />
          </CardContent>
        </Card>
      )}

      {/* ── Per-org summary table ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("perOrg")}</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Inbox size={32} className="mb-2" />
              <p className="text-sm">{t("noData")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-left">
                    <th className="py-2 px-3 font-medium">{t("orgName")}</th>
                    <th className="py-2 px-3 font-medium">{t("orgCode")}</th>
                    <th className="py-2 px-3 font-medium text-center">
                      {t("totalRisks")}
                    </th>
                    <th className="py-2 px-3 font-medium text-center">
                      {t("criticalCount")}
                    </th>
                    <th className="py-2 px-3 font-medium text-center">
                      {t("appetiteExceeded")}
                    </th>
                    <th className="py-2 px-3 font-medium text-center">
                      {t("redKris")}
                    </th>
                    <th className="py-2 px-3 font-medium text-center">
                      {t("avgScore")}
                    </th>
                    <th className="py-2 px-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((org) => (
                    <tr
                      key={org.orgId}
                      className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push("/risks")}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") router.push("/risks");
                      }}
                    >
                      <td className="py-3 px-3 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-gray-400" />
                          {org.orgName}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-500 font-mono text-xs">
                        {org.orgCode ?? "-"}
                      </td>
                      <td className="py-3 px-3 text-center">{org.totalRisks}</td>
                      <td className="py-3 px-3 text-center">
                        {org.criticalCount > 0 ? (
                          <Badge variant="destructive">
                            {org.criticalCount}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {org.appetiteExceededCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <AlertTriangle size={12} />
                            {org.appetiteExceededCount}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {org.kriRedCount > 0 ? (
                          <span className="text-red-600 font-medium">
                            {org.kriRedCount}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                            org.avgScore >= 15
                              ? "bg-red-100 text-red-900"
                              : org.avgScore >= 10
                                ? "bg-orange-100 text-orange-900"
                                : org.avgScore >= 5
                                  ? "bg-yellow-100 text-yellow-900"
                                  : "bg-green-100 text-green-900"
                          }`}
                        >
                          {typeof org.avgScore === "number"
                            ? org.avgScore.toFixed(1)
                            : "-"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <ExternalLink
                          size={14}
                          className="text-gray-400"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page with ModuleGate
// ---------------------------------------------------------------------------

export default function GroupRiskPage() {
  return (
    <ModuleGate moduleKey="erm">
      <GroupRiskContent />
    </ModuleGate>
  );
}
