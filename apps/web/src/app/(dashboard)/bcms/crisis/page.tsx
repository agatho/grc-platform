"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, AlertTriangle } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CrisisScenario } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  standby: "bg-gray-100 text-gray-700",
  activated: "bg-red-100 text-red-900",
  resolved: "bg-green-100 text-green-900",
  post_mortem: "bg-purple-100 text-purple-900",
};

const SEVERITY_COLORS: Record<string, string> = {
  level_1_incident: "bg-blue-100 text-blue-900",
  level_2_emergency: "bg-yellow-100 text-yellow-900",
  level_3_crisis: "bg-orange-100 text-orange-900",
  level_4_catastrophe: "bg-red-100 text-red-900",
};

export default function CrisisListPage() {
  return (
    <ModuleGate moduleKey="bcms">
      <CrisisListInner />
    </ModuleGate>
  );
}

function CrisisListInner() {
  const t = useTranslations("bcms");
  const router = useRouter();
  const [items, setItems] = useState<CrisisScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("it_outage");
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/bcms/crisis?limit=100");
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
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/bcms/crisis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, category: newCategory }),
      });
      if (res.ok) {
        const json = await res.json();
        router.push(`/bcms/crisis/${json.data.id}`);
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

  const activeCrises = items.filter((i) => i.status === "activated");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("crisis.title")}</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1" /> {t("common.create")}
        </Button>
      </div>

      {/* Active crisis banner */}
      {activeCrises.length > 0 && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="font-semibold text-red-800">
              {activeCrises.length} {t("activeCrisis")}
            </span>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("common.name")}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {["cyber_attack", "fire", "pandemic", "supply_chain", "natural_disaster", "it_outage", "other"].map((cat) => (
                <option key={cat} value={cat}>{t(`crisis.categories.${cat}`)}</option>
              ))}
            </select>
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
        <p className="text-center text-gray-400 py-12">{t("crisis.empty")}</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.name")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("crisis.category")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("crisis.severity")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.status")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.updated")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={`cursor-pointer transition-colors ${item.status === "activated" ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}`}
                  onClick={() => router.push(`/bcms/crisis/${item.id}`)}
                >
                  <td className="px-4 py-3 font-medium">
                    {item.status === "activated" && <AlertTriangle className="inline h-4 w-4 text-red-500 mr-1" />}
                    <Link href={`/bcms/crisis/${item.id}`} className="text-blue-700 hover:text-blue-900">
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px]">
                      {t(`crisis.categories.${item.category}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={SEVERITY_COLORS[item.severity]}>
                      {item.severity.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_COLORS[item.status]}>
                      {t(`crisis.status.${item.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(item.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
