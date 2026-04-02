"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Download, RefreshCcw, FileCheck, ShieldCheck } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SoaApplicability, SoaImplementation } from "@grc/shared";

interface SoaRow {
  id: string;
  catalogEntryId: string;
  controlId?: string;
  applicability: SoaApplicability;
  applicabilityJustification?: string;
  implementation: SoaImplementation;
  implementationNotes?: string;
  responsibleId?: string;
  catalogCode?: string;
  catalogTitleDe?: string;
  catalogTitleEn?: string;
}

interface SoaStats {
  total: number;
  applicable: number;
  notApplicable: number;
  partiallyApplicable: number;
  implemented: number;
  partiallyImplemented: number;
  planned: number;
  notImplemented: number;
  implementationPercentage: number;
}

const APPLICABILITY_COLORS: Record<SoaApplicability, string> = {
  applicable: "bg-green-100 text-green-700",
  not_applicable: "bg-gray-100 text-gray-500",
  partially_applicable: "bg-yellow-100 text-yellow-700",
};

const IMPLEMENTATION_COLORS: Record<SoaImplementation, string> = {
  implemented: "bg-green-100 text-green-700",
  partially_implemented: "bg-yellow-100 text-yellow-700",
  planned: "bg-blue-100 text-blue-700",
  not_implemented: "bg-red-100 text-red-700",
};

export default function SoaPage() {
  return (
    <ModuleGate moduleKey="isms">
      <SoaInner />
    </ModuleGate>
  );
}

function SoaInner() {
  const t = useTranslations("ismsAssessment");
  const [rows, setRows] = useState<SoaRow[]>([]);
  const [stats, setStats] = useState<SoaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [populating, setPopulating] = useState(false);
  const [populateResult, setPopulateResult] = useState<{ created: number; skipped: number } | null>(null);
  const [editForm, setEditForm] = useState<{
    applicability: SoaApplicability;
    implementation: SoaImplementation;
    applicabilityJustification: string;
    implementationNotes: string;
  }>({ applicability: "applicable", implementation: "not_implemented", applicabilityJustification: "", implementationNotes: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (search) params.set("search", search);
      if (filter === "applicable") params.set("applicability", "applicable");
      if (filter === "not_applicable") params.set("applicability", "not_applicable");
      if (filter === "not_implemented") params.set("implementation", "not_implemented");

      const res = await fetch(`/api/v1/isms/soa?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setRows(json.data ?? []);
        setStats(json.stats ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    await fetch("/api/v1/isms/soa", { method: "POST" });
    void fetchData();
  };

  const handlePopulateFromAnnexA = async () => {
    setPopulating(true);
    setPopulateResult(null);
    try {
      const res = await fetch("/api/v1/isms/soa/populate", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setPopulateResult({ created: json.created ?? 0, skipped: json.skipped ?? 0 });
        void fetchData();
      }
    } finally {
      setPopulating(false);
    }
  };

  const handleExport = () => {
    window.open("/api/v1/isms/soa/export", "_blank");
  };

  const startEdit = (row: SoaRow) => {
    setEditingId(row.id);
    setEditForm({
      applicability: row.applicability,
      implementation: row.implementation,
      applicabilityJustification: row.applicabilityJustification ?? "",
      implementationNotes: row.implementationNotes ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await fetch(`/api/v1/isms/soa/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setEditingId(null);
    void fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("soa.title")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePopulateFromAnnexA} disabled={populating}>
            {populating ? <Loader2 size={14} className="mr-1 animate-spin" /> : <ShieldCheck size={14} className="mr-1" />}
            {t("soa.populateAnnexA")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerate}>
            <RefreshCcw size={14} className="mr-1" /> {t("soa.generate")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download size={14} className="mr-1" /> {t("soa.export")}
          </Button>
        </div>
      </div>

      {/* Populate Result */}
      {populateResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center justify-between">
          <p className="text-sm text-green-800">
            {t("soa.populateResult", { created: populateResult.created, skipped: populateResult.skipped })}
          </p>
          <button
            onClick={() => setPopulateResult(null)}
            className="text-green-600 hover:text-green-800 text-sm font-medium"
          >
            {t("actions.dismiss")}
          </button>
        </div>
      )}

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">{t("soa.controls")}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.applicable}</p>
            <p className="text-xs text-gray-500">{t("soa.applicable")}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.implementationPercentage}%</p>
            <p className="text-xs text-gray-500">{t("soa.implementationPct")}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.notImplemented}</p>
            <p className="text-xs text-gray-500">{t("soa.notImplementedApplicable")}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {["all", "applicable", "not_applicable", "not_implemented"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                filter === f ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {t(`soa.filters.${f}`)}
              {stats && f === "applicable" && ` (${stats.applicable})`}
              {stats && f === "not_applicable" && ` (${stats.notApplicable})`}
              {stats && f === "not_implemented" && ` (${stats.notImplemented})`}
            </button>
          ))}
        </div>
        <input
          className="flex-1 max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          placeholder={t("soa.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>{t("soa.empty")}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={handleGenerate}>
            {t("soa.generate")}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("soa.reference")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("soa.controlName")}</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">{t("soa.applicable")}</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">{t("soa.implementation")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("soa.linkedControl")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => editingId === row.id ? null : startEdit(row)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.catalogCode ?? "-"}</td>
                  <td className="px-4 py-3 text-gray-900">{row.catalogTitleDe ?? row.catalogTitleEn ?? "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className={APPLICABILITY_COLORS[row.applicability]}>
                      {t(`soa.applicabilityValues.${row.applicability}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className={IMPLEMENTATION_COLORS[row.implementation]}>
                      {t(`soa.implementationValues.${row.implementation}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{row.controlId ? row.controlId.slice(0, 8) + "..." : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inline Edit Panel */}
      {editingId && (
        <div className="fixed inset-x-0 bottom-0 bg-white border-t border-gray-200 shadow-lg p-6 z-50">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{t("soa.editEntry")}</h3>
              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 text-sm">{t("actions.cancel")}</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t("soa.applicable")}</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={editForm.applicability}
                  onChange={(e) => setEditForm({ ...editForm, applicability: e.target.value as SoaApplicability })}
                >
                  <option value="applicable">{t("soa.applicabilityValues.applicable")}</option>
                  <option value="not_applicable">{t("soa.applicabilityValues.not_applicable")}</option>
                  <option value="partially_applicable">{t("soa.applicabilityValues.partially_applicable")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t("soa.implementation")}</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={editForm.implementation}
                  onChange={(e) => setEditForm({ ...editForm, implementation: e.target.value as SoaImplementation })}
                >
                  <option value="implemented">{t("soa.implementationValues.implemented")}</option>
                  <option value="partially_implemented">{t("soa.implementationValues.partially_implemented")}</option>
                  <option value="planned">{t("soa.implementationValues.planned")}</option>
                  <option value="not_implemented">{t("soa.implementationValues.not_implemented")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t("soa.justification")}</label>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={editForm.applicabilityJustification}
                  onChange={(e) => setEditForm({ ...editForm, applicabilityJustification: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t("soa.notes")}</label>
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={editForm.implementationNotes}
                  onChange={(e) => setEditForm({ ...editForm, implementationNotes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={saveEdit}>{t("actions.save")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
