"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BiaAssessment } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  archived: "bg-gray-50 text-gray-400",
};

export default function BiaListPage() {
  return (
    <ModuleGate moduleKey="bcms">
      <BiaListInner />
    </ModuleGate>
  );
}

function BiaListInner() {
  const t = useTranslations("bcms");
  const router = useRouter();
  const [items, setItems] = useState<BiaAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/bcms/bia?limit=100");
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
      const res = await fetch("/api/v1/bcms/bia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        const json = await res.json();
        router.push(`/bcms/bia/${json.data.id}`);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("bia.title")}</h1>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus size={14} className="mr-1" /> {t("bia.create")}
        </Button>
      </div>

      {/* Create dialog */}
      {showCreateDialog && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("common.name")}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 size={14} className="animate-spin" /> : t("common.create")}
            </Button>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {items.length === 0 ? (
        <p className="text-center text-gray-400 py-12">{t("bia.empty")}</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.name")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.status")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.created")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/bcms/bia/${item.id}`)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_COLORS[item.status]}>
                      {t(`bia.status.${item.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
