"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DataBreach } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  detected: "bg-red-100 text-red-900",
  assessing: "bg-orange-100 text-orange-900",
  notifying_dpa: "bg-yellow-100 text-yellow-900",
  notifying_individuals: "bg-blue-100 text-blue-900",
  remediation: "bg-teal-100 text-teal-900",
  closed: "bg-gray-100 text-gray-500",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-900",
  medium: "bg-yellow-100 text-yellow-900",
  high: "bg-orange-100 text-orange-900",
  critical: "bg-red-100 text-red-900",
};

export default function BreachListPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <BreachListInner />
    </ModuleGate>
  );
}

function BreachListInner() {
  const t = useTranslations("dpms");
  const router = useRouter();
  const [items, setItems] = useState<DataBreach[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      if (severityFilter) params.set("severity", severityFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/v1/dpms/breaches?${params}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, search]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("breaches.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("breaches.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => router.push("/dpms/breaches/new")}>
          <Plus size={14} className="mr-1" />
          {t("breaches.create")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder={t("breaches.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("breaches.allStatuses")}</option>
          <option value="detected">{t("breaches.status.detected")}</option>
          <option value="assessing">{t("breaches.status.assessing")}</option>
          <option value="notifying_dpa">{t("breaches.status.notifying_dpa")}</option>
          <option value="notifying_individuals">{t("breaches.status.notifying_individuals")}</option>
          <option value="remediation">{t("breaches.status.remediation")}</option>
          <option value="closed">{t("breaches.status.closed")}</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("breaches.allSeverities")}</option>
          <option value="low">{t("breaches.severity_low")}</option>
          <option value="medium">{t("breaches.severity_medium")}</option>
          <option value="high">{t("breaches.severity_high")}</option>
          <option value="critical">{t("breaches.severity_critical")}</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{t("breaches.empty")}</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("breaches.titleField")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("breaches.severity")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("breaches.statusLabel")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("breaches.countdown")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("breaches.detected")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const detectedAt = new Date(item.detectedAt);
                const deadline72h = new Date(detectedAt.getTime() + 72 * 60 * 60 * 1000);
                const now = new Date();
                const hoursRemaining = Math.max(0, Math.floor((deadline72h.getTime() - now.getTime()) / (1000 * 60 * 60)));
                const isOverdue = deadline72h.getTime() < now.getTime();
                const isClosed = item.status === "closed";

                return (
                  <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/dpms/breaches/${item.id}`)}>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${SEVERITY_COLORS[item.severity] ?? ""}`}>
                        {item.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[item.status] ?? ""}`}>
                        {item.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {!isClosed && !item.dpaNotifiedAt && (
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          isOverdue ? "bg-red-100 text-red-900" : hoursRemaining <= 24 ? "bg-orange-100 text-orange-900" : "bg-yellow-100 text-yellow-900"
                        }`}>
                          {isOverdue ? t("breaches.expired") : `${hoursRemaining}h`}
                        </span>
                      )}
                      {item.dpaNotifiedAt && (
                        <span className="text-xs text-green-600">{t("breaches.dpaNotified")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{detectedAt.toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
