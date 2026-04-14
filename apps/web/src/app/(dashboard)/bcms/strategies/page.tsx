"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Plus, AlertTriangle, CheckCircle, Trash2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ContinuityStrategy } from "@grc/shared";

const STRATEGY_COLORS: Record<string, string> = {
  active_active: "bg-green-100 text-green-900",
  active_passive: "bg-blue-100 text-blue-900",
  cold_standby: "bg-yellow-100 text-yellow-900",
  manual_workaround: "bg-orange-100 text-orange-900",
  outsource: "bg-purple-100 text-purple-900",
  do_nothing: "bg-gray-100 text-gray-600",
};

export default function StrategyListPage() {
  return (
    <ModuleGate moduleKey="bcms">
      <ModuleTabNav />
      <StrategyListInner />
    </ModuleGate>
  );
}

function StrategyListInner() {
  const t = useTranslations("bcms");
  const router = useRouter();
  const [items, setItems] = useState<ContinuityStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("active_active");
  const [newRto, setNewRto] = useState<number>(4);
  const [newProcessId, setNewProcessId] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/bcms/strategies?limit=100");
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
    if (!newName.trim() || !newProcessId.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/bcms/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          strategyType: newType,
          rtoTargetHours: newRto,
          processId: newProcessId,
        }),
      });
      if (res.ok) {
        setNewName("");
        setShowCreate(false);
        void fetchData();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (stratId: string) => {
    await fetch(`/api/v1/bcms/strategies/${stratId}`, { method: "DELETE" });
    void fetchData();
  };

  const handleToggleActive = async (strat: ContinuityStrategy) => {
    await fetch(`/api/v1/bcms/strategies/${strat.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !strat.isActive }),
    });
    void fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const formatCurrency = (val: string | undefined) => {
    if (!val) return "-";
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(parseFloat(val));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("strategy.title")}</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1" /> {t("strategy.create")}
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("common.name")}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={newProcessId}
              onChange={(e) => setNewProcessId(e.target.value)}
              placeholder="Process ID (UUID)"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {["active_active", "active_passive", "cold_standby", "manual_workaround", "outsource", "do_nothing"].map((st) => (
                <option key={st} value={st}>{t(`strategy.type.${st}`)}</option>
              ))}
            </select>
            <input
              type="number"
              value={newRto}
              onChange={(e) => setNewRto(Number(e.target.value))}
              placeholder={`${t("strategy.rtoTarget")} (h)`}
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
        <p className="text-center text-gray-400 py-12">{t("strategy.empty")}</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.name")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("strategy.rtoTarget")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("strategy.annualCost")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("strategy.estimatedCost")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("strategy.requiredStaff")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Active</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((strat) => (
                <tr key={strat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{strat.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STRATEGY_COLORS[strat.strategyType]}>
                      {t(`strategy.type.${strat.strategyType}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{strat.rtoTargetHours}h</td>
                  <td className="px-4 py-3 text-gray-600">{formatCurrency(strat.annualCostEur)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatCurrency(strat.estimatedCostEur)}</td>
                  <td className="px-4 py-3 text-gray-600">{strat.requiredStaff ?? "-"} FTE</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggleActive(strat)}>
                      {strat.isActive
                        ? <CheckCircle size={16} className="text-green-600" />
                        : <span className="w-4 h-4 rounded-full border-2 border-gray-300 inline-block" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(strat.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cost-RTO scatter hint */}
      {items.length > 1 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">{t("strategy.comparison")}</h2>
          <div className="space-y-1">
            {items
              .sort((a, b) => a.rtoTargetHours - b.rtoTargetHours)
              .map((strat) => {
                const maxCost = Math.max(...items.map((s) => parseFloat(s.annualCostEur ?? "0") || 0), 1);
                const cost = parseFloat(strat.annualCostEur ?? "0") || 0;
                const pct = Math.round((cost / maxCost) * 100);
                return (
                  <div key={strat.id} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-32 truncate">{strat.name}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded">
                      <div
                        className={`h-full rounded transition-all ${strat.isActive ? "bg-green-400" : "bg-blue-300"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-16 text-right">{strat.rtoTargetHours}h</span>
                    <span className="text-xs text-gray-600 w-24 text-right">{formatCurrency(strat.annualCostEur)}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
