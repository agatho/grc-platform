"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  ArrowLeft,
  Plus,
  CalendarDays,
  List,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { GrcTimeEntry, GrcArea } from "@grc/shared";

const GRC_AREAS: GrcArea[] = [
  "erm", "isms", "ics", "dpms", "audit", "tprm", "bcms", "esg", "general",
];

const AREA_COLORS: Record<GrcArea, string> = {
  erm: "bg-red-200",
  isms: "bg-blue-200",
  ics: "bg-green-200",
  dpms: "bg-purple-200",
  audit: "bg-yellow-200",
  tprm: "bg-orange-200",
  bcms: "bg-teal-200",
  esg: "bg-emerald-200",
  general: "bg-gray-200",
};

interface DeptAnalysisRow {
  department: string;
  areas: Record<GrcArea, number>;
  totalHours: number;
  calculatedCost: number;
}

export default function TimeTrackingPage() {
  const t = useTranslations("budget");
  const router = useRouter();
  const [entries, setEntries] = useState<GrcTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"calendar" | "list">("list");
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newHours, setNewHours] = useState("1");
  const [newArea, setNewArea] = useState<GrcArea>("general");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Department analysis
  const [deptAnalysis, setDeptAnalysis] = useState<DeptAnalysisRow[]>([]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, dRes] = await Promise.all([
        fetch("/api/v1/budget/time"),
        fetch("/api/v1/budget/time/department-analysis"),
      ]);
      if (eRes.ok) {
        const json = await eRes.json();
        setEntries(json.data ?? []);
      }
      if (dRes.ok) {
        const json = await dRes.json();
        setDeptAnalysis(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/v1/budget/time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newDate,
          hours: newHours,
          grcArea: newArea,
          description: newDescription || undefined,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewDescription("");
        await fetchEntries();
      }
    } finally {
      setCreating(false);
    }
  };

  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours || 0), 0);

  // Group entries by date for calendar view
  const entriesByDate: Record<string, GrcTimeEntry[]> = {};
  for (const entry of entries) {
    const d = entry.date;
    if (!entriesByDate[d]) entriesByDate[d] = [];
    entriesByDate[d].push(entry);
  }

  if (loading && entries.length === 0) {
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
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/budget")}>
            <ArrowLeft size={14} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("time.title")}</h1>
            <p className="text-sm text-gray-500 mt-1">{t("time.subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-md border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`px-3 py-1.5 text-xs ${view === "calendar" ? "bg-gray-100 text-gray-900" : "text-gray-500"}`}
            >
              <CalendarDays size={14} className="inline mr-1" />
              {t("time.calendarView")}
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-3 py-1.5 text-xs ${view === "list" ? "bg-gray-100 text-gray-900" : "text-gray-500"}`}
            >
              <List size={14} className="inline mr-1" />
              {t("time.listView")}
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={fetchEntries} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus size={14} className="mr-1" />
            {t("time.recordTime")}
          </Button>
        </div>
      </div>

      {/* KPI Card */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="text-xs font-medium text-gray-600">{t("time.totalHours")}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}</p>
        </div>
        {GRC_AREAS.slice(0, 3).map((area) => {
          const areaHours = entries
            .filter((e) => e.grcArea === area)
            .reduce((sum, e) => sum + Number(e.hours || 0), 0);
          return (
            <div key={area} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${AREA_COLORS[area]}`} />
                <span className="text-xs font-medium text-gray-600">{t(`areas.${area}`)}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{areaHours.toFixed(1)}h</p>
            </div>
          );
        })}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t("time.recordTime")}</h2>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t("time.date")}</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t("time.hours")}</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                value={newHours}
                onChange={(e) => setNewHours(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-24"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t("time.area")}</label>
              <select
                value={newArea}
                onChange={(e) => setNewArea(e.target.value as GrcArea)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                {GRC_AREAS.map((a) => (
                  <option key={a} value={a}>{t(`areas.${a}`)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-gray-500">{t("time.description")}</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 size={14} className="animate-spin mr-1" />}
              {t("actions.save")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              {t("actions.cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Calendar / List View */}
      {view === "calendar" ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">{t("time.calendarView")}</h2>
          <div className="space-y-3">
            {Object.entries(entriesByDate)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, dayEntries]) => {
                const dayTotal = dayEntries.reduce((s, e) => s + Number(e.hours || 0), 0);
                return (
                  <div key={date} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{date}</span>
                      <span className="text-sm font-bold text-gray-700">{dayTotal.toFixed(1)}h</span>
                    </div>
                    <div className="flex gap-1 h-6">
                      {dayEntries.map((entry) => {
                        const widthPct = dayTotal > 0 ? (Number(entry.hours) / dayTotal) * 100 : 0;
                        return (
                          <div
                            key={entry.id}
                            className={`${AREA_COLORS[entry.grcArea]} rounded flex items-center justify-center text-[10px] text-gray-700`}
                            style={{ width: `${widthPct}%`, minWidth: "24px" }}
                            title={`${t(`areas.${entry.grcArea}`)}: ${entry.hours}h`}
                          >
                            {Number(entry.hours).toFixed(1)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            {Object.keys(entriesByDate).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">{t("time.noEntries")}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("time.date")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("time.area")}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t("time.hours")}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("time.description")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{entry.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${AREA_COLORS[entry.grcArea]}`} />
                        <span className="text-gray-700">{t(`areas.${entry.grcArea}`)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{Number(entry.hours).toFixed(1)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{entry.description ?? "-"}</td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">{t("time.noEntries")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Department Analysis */}
      {deptAnalysis.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">{t("time.departmentAnalysis")}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t("time.department")}</th>
                  {GRC_AREAS.map((a) => (
                    <th key={a} className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                      {t(`areas.${a}`)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 bg-gray-100">
                    {t("time.totalHours")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 bg-gray-100">
                    {t("time.calculatedCost")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {deptAnalysis.map((row) => (
                  <tr key={row.department} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.department}</td>
                    {GRC_AREAS.map((a) => (
                      <td key={a} className="px-4 py-3 text-right text-gray-600">
                        {(row.areas[a] ?? 0) > 0 ? (row.areas[a]).toFixed(1) : "-"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-medium text-gray-900 bg-gray-50">
                      {row.totalHours.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 bg-gray-50">
                      {row.calculatedCost.toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
