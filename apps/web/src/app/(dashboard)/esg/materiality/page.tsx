"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw, Plus, CalendarDays } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EsgMaterialityAssessment } from "@grc/shared";

export default function MaterialityListPage() {
  return (
    <ModuleGate moduleKey="esg">
      <MaterialityListInner />
    </ModuleGate>
  );
}

function MaterialityListInner() {
  const t = useTranslations("esg");
  const router = useRouter();
  const [assessments, setAssessments] = useState<EsgMaterialityAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear());

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/esg/materiality");
      if (res.ok) {
        const json = await res.json();
        setAssessments(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAssessments();
  }, [fetchAssessments]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/v1/esg/materiality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportingYear: newYear }),
      });
      if (res.ok) {
        setShowCreate(false);
        await fetchAssessments();
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading && assessments.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">{t("materiality.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("materiality.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAssessments} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} className="mr-1" />
            {t("materiality.createAssessment")}
          </Button>
        </div>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t("materiality.createAssessment")}</h3>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("materiality.selectYear")}</label>
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(Number(e.target.value))}
                min={2020}
                max={2040}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-28"
              />
            </div>
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 size={14} className="animate-spin" /> : t("create")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Assessment Cards */}
      {assessments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t("empty")}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assessments.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => router.push(`/esg/materiality/${a.reportingYear}`)}
              className="rounded-lg border border-gray-200 bg-white p-6 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-gray-400" />
                  <span className="text-lg font-bold text-gray-900">{a.reportingYear}</span>
                </div>
                <MaterialityStatusBadge status={a.status} t={t} />
              </div>
              <p className="text-xs text-gray-500">
                {a.startedAt ? new Date(a.startedAt).toLocaleDateString() : "-"}
                {a.completedAt && ` - ${new Date(a.completedAt).toLocaleDateString()}`}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialityStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
  };
  return (
    <Badge variant="outline" className={`${colors[status] ?? ""} text-[10px]`}>
      {t(`materiality.status.${status}`)}
    </Badge>
  );
}
