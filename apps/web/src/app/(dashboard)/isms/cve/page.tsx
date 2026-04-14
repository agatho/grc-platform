"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Search,
  RefreshCcw,
  ShieldAlert,
  AlertTriangle,
  Server,
  Clock,
  ExternalLink,
  Check,
  X,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CveDashboardKpis } from "@grc/shared";

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

const severityStyles: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-gray-100 text-gray-700 border-gray-200",
  none: "bg-gray-50 text-gray-500 border-gray-100",
};

const statusStyles: Record<string, string> = {
  new: "bg-blue-100 text-blue-900",
  acknowledged: "bg-yellow-100 text-yellow-900",
  mitigated: "bg-green-100 text-green-900",
  not_applicable: "bg-gray-100 text-gray-500",
};

interface CveMatch {
  id: string;
  cveId: string;
  assetId: string;
  orgId: string;
  matchedCpe?: string;
  status: string;
  acknowledgedBy?: string;
  linkedVulnerabilityId?: string;
  matchedAt: string;
  cveIdStr?: string;
  cveTitle?: string;
  cvssScore?: string;
  cvssSeverity?: string;
  cvePublishedAt?: string;
  assetName?: string;
}

export default function CveDashboardPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ModuleTabNav />
      <CveDashboardInner />
    </ModuleGate>
  );
}

function CveDashboardInner() {
  const t = useTranslations("cve");
  const [kpis, setKpis] = useState<CveDashboardKpis | null>(null);
  const [matches, setMatches] = useState<CveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [severityFilter, setSeverityFilter] = useState("__all__");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (statusFilter !== "__all__") params.set("status", statusFilter);
      if (severityFilter !== "__all__") params.set("severity", severityFilter);

      const [kpiRes, matchRes] = await Promise.all([
        fetch("/api/v1/isms/cve/dashboard"),
        fetch(`/api/v1/isms/cve/matches?${params.toString()}`),
      ]);

      if (kpiRes.ok) {
        const kpiJson = await kpiRes.json();
        setKpis(kpiJson.data);
      }
      if (matchRes.ok) {
        const matchJson = await matchRes.json();
        setMatches(matchJson.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search) return matches;
    const q = search.toLowerCase();
    return matches.filter(
      (m) =>
        m.cveIdStr?.toLowerCase().includes(q) ||
        m.cveTitle?.toLowerCase().includes(q) ||
        m.assetName?.toLowerCase().includes(q),
    );
  }, [matches, search]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/v1/isms/cve/dashboard");
      if (res.ok) toast.success("Sync triggered");
      void fetchData();
    } finally {
      setSyncing(false);
    }
  };

  const handleAcknowledge = async (matchId: string, status: string) => {
    const res = await fetch(`/api/v1/isms/cve/matches/${matchId}/acknowledge`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(t("acknowledgeSuccess"));
      void fetchData();
    }
  };

  const handleConvert = async (matchId: string) => {
    const res = await fetch(`/api/v1/isms/cve/matches/${matchId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      toast.success(t("convertSuccess"));
      void fetchData();
    }
  };

  const handleBulkAcknowledge = async () => {
    if (selectedIds.size === 0) return;
    const res = await fetch("/api/v1/isms/cve/matches/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchIds: Array.from(selectedIds),
        status: "acknowledged",
      }),
    });
    if (res.ok) {
      toast.success(t("acknowledgeSuccess"));
      setSelectedIds(new Set());
      void fetchData();
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading && matches.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {kpis?.lastSyncAt && (
            <span className="text-xs text-gray-400">
              {t("lastSync")}: {new Date(kpis.lastSyncAt).toLocaleString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCcw size={14} className={syncing ? "animate-spin" : ""} />
            <span className="ml-1">{t("actions.syncNow")}</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-blue-600" />
              <p className="text-xs text-gray-500">{t("kpi.openMatches")}</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-2">{kpis.openMatches}</p>
            <p className="text-xs text-gray-400 mt-1">
              +{kpis.newMatchesLast7Days} {t("kpi.newLast7Days")}
            </p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-600" />
              <p className="text-xs text-red-600">{t("kpi.criticalCves")}</p>
            </div>
            <p className="text-2xl font-bold text-red-700 mt-2">{kpis.criticalCves}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Server size={16} className="text-purple-600" />
              <p className="text-xs text-gray-500">{t("kpi.affectedAssets")}</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-2">{kpis.affectedAssets}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-green-600" />
              <p className="text-xs text-gray-500">{t("kpi.meanRemediation")}</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {kpis.meanRemediationDays.toFixed(1)}
            </p>
            <p className="text-xs text-gray-400">{t("kpi.days")}</p>
          </div>
        </div>
      )}

      {/* Filters + Bulk Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("filters.searchPlaceholder")}
              className="h-8 w-56 rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder={t("filters.allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("filters.allStatuses")}</SelectItem>
              {["new", "acknowledged", "mitigated", "not_applicable"].map((s) => (
                <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder={t("filters.allSeverities")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("filters.allSeverities")}</SelectItem>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>{t(`severity.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedIds.size > 0 && (
          <Button size="sm" variant="outline" onClick={handleBulkAcknowledge}>
            <Check size={14} className="mr-1" />
            {t("actions.bulkAcknowledge")} ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Matches Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <ShieldAlert size={28} className="text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">{t("empty")}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8 px-2 py-3">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filtered.map((m) => m.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">{t("table.cveId")}</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">{t("table.cvssScore")}</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">{t("table.title")}</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">{t("table.assetName")}</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600">{t("table.status")}</th>
                <th className="text-left px-3 py-3 font-medium text-gray-600">{t("table.matchedAt")}</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((match) => (
                <tr key={match.id} className="hover:bg-gray-50">
                  <td className="px-2 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(match.id)}
                      onChange={() => toggleSelection(match.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <a
                      href={`https://nvd.nist.gov/vuln/detail/${match.cveIdStr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {match.cveIdStr} <ExternalLink size={10} />
                    </a>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Badge
                      variant="outline"
                      className={severityStyles[match.cvssSeverity ?? "none"]}
                    >
                      {match.cvssScore ?? "-"} {match.cvssSeverity ? t(`severity.${match.cvssSeverity}`) : ""}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-gray-900 max-w-xs truncate">
                    {match.cveTitle?.slice(0, 100) ?? "-"}
                  </td>
                  <td className="px-3 py-3 text-gray-700">{match.assetName ?? "-"}</td>
                  <td className="px-3 py-3 text-center">
                    <Badge variant="outline" className={statusStyles[match.status] ?? ""}>
                      {t(`status.${match.status}`)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {new Date(match.matchedAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {match.status === "new" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAcknowledge(match.id, "acknowledged")}
                          title={t("actions.acknowledge")}
                        >
                          <Check size={14} className="text-green-600" />
                        </Button>
                      )}
                      {(match.status === "new" || match.status === "acknowledged") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAcknowledge(match.id, "not_applicable")}
                          title={t("actions.markNotApplicable")}
                        >
                          <X size={14} className="text-gray-400" />
                        </Button>
                      )}
                      {!match.linkedVulnerabilityId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleConvert(match.id)}
                          title={t("actions.convertToVulnerability")}
                        >
                          <ArrowRight size={14} className="text-purple-600" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
