"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Dsr } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-700",
  verified: "bg-teal-100 text-teal-700",
  processing: "bg-yellow-100 text-yellow-700",
  response_sent: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-500",
  rejected: "bg-red-100 text-red-700",
};

function getSlaColor(daysRemaining: number): string {
  if (daysRemaining <= 0) return "text-red-600 bg-red-50";
  if (daysRemaining <= 5) return "text-red-600 bg-red-50";
  if (daysRemaining <= 15) return "text-yellow-600 bg-yellow-50";
  return "text-green-600 bg-green-50";
}

export default function DsrListPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <DsrListInner />
    </ModuleGate>
  );
}

function DsrListInner() {
  const t = useTranslations("dpms");
  const router = useRouter();
  const [items, setItems] = useState<Dsr[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("requestType", typeFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/v1/dpms/dsr?${params}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, search]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("dsr.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("dsr.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => router.push("/dpms/dsr/new")}>
          <Plus size={14} className="mr-1" />
          {t("dsr.create")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder={t("dsr.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("dsr.allStatuses")}</option>
          <option value="received">{t("dsr.status.received")}</option>
          <option value="verified">{t("dsr.status.verified")}</option>
          <option value="processing">{t("dsr.status.processing")}</option>
          <option value="response_sent">{t("dsr.status.response_sent")}</option>
          <option value="closed">{t("dsr.status.closed")}</option>
          <option value="rejected">{t("dsr.status.rejected")}</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("dsr.allTypes")}</option>
          <option value="access">{t("dsr.requestType.access")}</option>
          <option value="erasure">{t("dsr.requestType.erasure")}</option>
          <option value="restriction">{t("dsr.requestType.restriction")}</option>
          <option value="portability">{t("dsr.requestType.portability")}</option>
          <option value="objection">{t("dsr.requestType.objection")}</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{t("dsr.empty")}</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("dsr.subject")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("dsr.type")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("dsr.statusLabel")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("dsr.sla")}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">{t("dsr.deadline")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const deadline = new Date(item.deadline);
                const now = new Date();
                const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isClosed = item.status === "closed" || item.status === "rejected";

                return (
                  <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/dpms/dsr/${item.id}`)}>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.subjectName ?? "-"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{item.requestType}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[item.status] ?? ""}`}>
                        {item.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {!isClosed && (
                        <span className={`text-xs font-medium px-2 py-1 rounded ${getSlaColor(daysRemaining)}`}>
                          {daysRemaining <= 0
                            ? t("dsr.overdue")
                            : `${daysRemaining}d`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{deadline.toLocaleDateString()}</td>
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
