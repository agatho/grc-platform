"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  AlertTriangle,
  Shield,
  Clock,
  Filter,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WbCaseListItem } from "@grc/shared";

export default function WbCasesPage() {
  return (
    <ModuleGate moduleKey="whistleblowing">
      <CaseListInner />
    </ModuleGate>
  );
}

const STATUS_COLORS: Record<string, string> = {
  received: "bg-gray-100 text-gray-700",
  acknowledged: "bg-blue-100 text-blue-700",
  investigating: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-200 text-gray-600",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

const CATEGORY_COLORS: Record<string, string> = {
  fraud: "bg-red-100 text-red-700",
  corruption: "bg-orange-100 text-orange-700",
  discrimination: "bg-purple-100 text-purple-700",
  privacy: "bg-violet-100 text-violet-700",
  environmental: "bg-green-100 text-green-700",
  health_safety: "bg-amber-100 text-amber-700",
  other: "bg-gray-100 text-gray-600",
};

function deadlineBadge(deadline: string, completedAt?: string | null): React.ReactNode {
  if (completedAt) {
    return <Badge className="bg-green-100 text-green-700 text-xs">OK</Badge>;
  }
  const days = Math.ceil(
    (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (days < 0) {
    return <Badge className="bg-red-100 text-red-700 text-xs">Overdue</Badge>;
  }
  if (days <= 3) {
    return <Badge className="bg-yellow-100 text-yellow-700 text-xs">{days}d</Badge>;
  }
  return <Badge className="bg-green-100 text-green-700 text-xs">{days}d</Badge>;
}

function CaseListInner() {
  const t = useTranslations("whistleblowing");
  const router = useRouter();
  const [cases, setCases] = useState<WbCaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);

      const res = await fetch(`/api/v1/whistleblowing/cases?${params}`);
      if (res.ok) {
        const json = await res.json();
        setCases(json.data ?? []);
        setTotal(json.pagination?.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCases}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          {t("refresh")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5"
        >
          <option value="">{t("allStatuses")}</option>
          <option value="received">{t("status.received")}</option>
          <option value="acknowledged">{t("status.acknowledged")}</option>
          <option value="investigating">{t("status.investigating")}</option>
          <option value="resolved">{t("status.resolved")}</option>
          <option value="closed">{t("status.closed")}</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5"
        >
          <option value="">{t("allPriorities")}</option>
          <option value="critical">{t("priority.critical")}</option>
          <option value="high">{t("priority.high")}</option>
          <option value="medium">{t("priority.medium")}</option>
          <option value="low">{t("priority.low")}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16">
          <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{t("noCases")}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">{t("caseNumber")}</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">{t("category")}</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">{t("statusLabel")}</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">{t("priorityLabel")}</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">{t("submitted")}</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">{t("sla7d")}</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">{t("sla3m")}</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">{t("assignee")}</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => router.push(`/whistleblowing/cases/${c.id}`)}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/whistleblowing/cases/${c.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {c.caseNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${CATEGORY_COLORS[c.category] ?? ""}`}>
                      {t(`cat.${c.category}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${STATUS_COLORS[c.status] ?? ""}`}>
                      {t(`status.${c.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`text-xs ${PRIORITY_COLORS[c.priority] ?? ""}`}>
                      {t(`priority.${c.priority}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(c.submittedAt).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3">
                    {deadlineBadge(c.acknowledgeDeadline, c.acknowledgedAt)}
                  </td>
                  <td className="px-4 py-3">
                    {deadlineBadge(c.responseDeadline)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {c.assignedToName ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {t("showing")} {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} {t("of")} {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              {t("prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * 20 >= total}
              onClick={() => setPage(page + 1)}
            >
              {t("next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
