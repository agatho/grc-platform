"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Bcp } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_review: "bg-yellow-100 text-yellow-900",
  approved: "bg-blue-100 text-blue-900",
  published: "bg-green-100 text-green-900",
  archived: "bg-gray-50 text-gray-400",
  superseded: "bg-orange-100 text-orange-900",
};

export default function BcpListPage() {
  return (
    <ModuleGate moduleKey="bcms">
      <BcpListInner />
    </ModuleGate>
  );
}

function BcpListInner() {
  const t = useTranslations("bcms");
  const router = useRouter();
  const [items, setItems] = useState<Bcp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/bcms/plans?limit=100");
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
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/bcms/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        const json = await res.json();
        router.push(`/bcms/plans/${json.data.id}`);
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
        <h1 className="text-2xl font-bold text-gray-900">{t("bcp.title")}</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1" /> {t("bcp.create")}
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t("common.name")}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
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
        <p className="text-center text-gray-400 py-12">{t("bcp.empty")}</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.name")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.status")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("bcp.version")}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.updated")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => router.push(`/bcms/plans/${item.id}`)}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/bcms/plans/${item.id}`} className="text-blue-700 hover:text-blue-900">
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_COLORS[item.status]}>
                      {t(`bcp.status.${item.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">v{item.version}</td>
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
