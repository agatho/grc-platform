"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Calendar, List } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BcExercise } from "@grc/shared";

const TYPE_COLORS: Record<string, string> = {
  tabletop: "bg-blue-100 text-blue-700",
  walkthrough: "bg-green-100 text-green-700",
  functional: "bg-yellow-100 text-yellow-700",
  full_simulation: "bg-red-100 text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-gray-100 text-gray-700",
  preparation: "bg-blue-100 text-blue-700",
  executing: "bg-orange-100 text-orange-700",
  evaluation: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const RESULT_COLORS: Record<string, string> = {
  successful: "bg-green-100 text-green-700",
  partially_successful: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
};

export default function ExerciseListPage() {
  return (
    <ModuleGate moduleKey="bcms">
      <ExerciseListInner />
    </ModuleGate>
  );
}

function ExerciseListInner() {
  const t = useTranslations("bcms");
  const router = useRouter();
  const [items, setItems] = useState<BcExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("tabletop");
  const [newDate, setNewDate] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/bcms/exercises?limit=100");
      if (res.ok) {
        const json = await res.json();
        setItems(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newDate) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/bcms/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          exerciseType: newType,
          plannedDate: newDate,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        router.push(`/bcms/exercises/${json.data.id}`);
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // Calendar view: group by month
  const byMonth: Record<string, BcExercise[]> = {};
  for (const ex of items) {
    const month = ex.plannedDate.substring(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(ex);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("exercise.title")}</h1>
        <div className="flex gap-2">
          <div className="flex rounded-md border border-gray-200">
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 text-sm ${viewMode === "calendar" ? "bg-blue-50 text-blue-600" : "text-gray-500"}`}
            >
              <Calendar size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-blue-50 text-blue-600" : "text-gray-500"}`}
            >
              <List size={14} />
            </button>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={14} className="mr-1" /> {t("exercise.create")}
          </Button>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t("common.name")}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {["tabletop", "walkthrough", "functional", "full_simulation"].map((et) => (
                <option key={et} value={et}>{t(`exercise.type.${et}`)}</option>
              ))}
            </select>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 size={14} className="animate-spin" /> : t("common.create")}
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-center text-gray-400 py-12">{t("exercise.empty")}</p>
      ) : viewMode === "list" ? (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.name")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("exercise.plannedDate")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.status")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((ex) => (
                <tr key={ex.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/bcms/exercises/${ex.id}`)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{ex.title}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={TYPE_COLORS[ex.exerciseType]}>
                      {t(`exercise.type.${ex.exerciseType}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{ex.plannedDate}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_COLORS[ex.status]}>
                      {t(`exercise.status.${ex.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {ex.overallResult ? (
                      <Badge variant="outline" className={RESULT_COLORS[ex.overallResult]}>
                        {t(`exercise.result.${ex.overallResult}`)}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Calendar view */
        <div className="space-y-4">
          {Object.entries(byMonth)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, exercises]) => (
              <div key={month} className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {new Date(month + "-01").toLocaleDateString(undefined, { year: "numeric", month: "long" })}
                </h3>
                <div className="space-y-2">
                  {exercises.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => router.push(`/bcms/exercises/${ex.id}`)}
                      className="w-full flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2 hover:bg-blue-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={TYPE_COLORS[ex.exerciseType] + " text-[10px]"}>
                          {t(`exercise.type.${ex.exerciseType}`)}
                        </Badge>
                        <span className="text-sm font-medium text-gray-900">{ex.title}</span>
                      </div>
                      <span className="text-xs text-gray-500">{ex.plannedDate}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        {["tabletop", "walkthrough", "functional", "full_simulation"].map((et) => (
          <div key={et} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded-full ${TYPE_COLORS[et].split(" ")[0]}`} />
            {t(`exercise.type.${et}`)}
          </div>
        ))}
      </div>
    </div>
  );
}
