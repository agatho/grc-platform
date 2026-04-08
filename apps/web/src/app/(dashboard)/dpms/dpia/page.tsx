"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Dpia } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-900",
  completed: "bg-teal-100 text-teal-900",
  pending_dpo_review: "bg-yellow-100 text-yellow-900",
  approved: "bg-green-100 text-green-900",
  rejected: "bg-red-100 text-red-900",
};

export default function DpiaListPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <DpiaListInner />
    </ModuleGate>
  );
}

function DpiaListInner() {
  const t = useTranslations("dpms");
  const router = useRouter();
  const [items, setItems] = useState<Dpia[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/v1/dpms/dpia?${params}`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("dpia.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("dpia.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => router.push("/dpms/dpia/new")}>
          <Plus size={14} className="mr-1" />
          {t("dpia.create")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder={t("dpia.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">{t("dpia.allStatuses")}</option>
          <option value="draft">{t("dpia.status.draft")}</option>
          <option value="in_progress">{t("dpia.status.in_progress")}</option>
          <option value="completed">{t("dpia.status.completed")}</option>
          <option value="pending_dpo_review">{t("dpia.status.pending_dpo_review")}</option>
          <option value="approved">{t("dpia.status.approved")}</option>
          <option value="rejected">{t("dpia.status.rejected")}</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{t("dpia.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/dpms/dpia/${item.id}`}
              className="rounded-lg border border-gray-200 bg-white p-4 text-left hover:shadow-sm transition-shadow cursor-pointer transition-colors block"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-blue-700 hover:text-blue-900 truncate">{item.title}</h3>
                <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[item.status] ?? ""}`}>
                  {item.status.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">
                {item.dpoConsultationRequired ? t("dpia.consultationRequired") : t("dpia.noConsultation")}
              </p>
              <p className="text-xs text-gray-400 mt-2">{new Date(item.updatedAt).toLocaleDateString()}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
