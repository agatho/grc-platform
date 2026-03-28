"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw, Trash2, Settings } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Installation {
  id: string;
  listingId: string;
  versionId: string;
  status: string;
  autoUpdate: boolean;
  installedAt: string;
}

export default function InstalledPage() {
  return (
    <ModuleGate moduleKey="marketplace">
      <InstalledList />
    </ModuleGate>
  );
}

function InstalledList() {
  const t = useTranslations("marketplace");
  const [items, setItems] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/marketplace/installations");
      if (res.ok) setItems((await res.json()).data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleUninstall = async (id: string) => {
    await fetch(`/api/v1/marketplace/installations/${id}`, { method: "DELETE" });
    void fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("installedTitle")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("installedDescription")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t("noInstalled")}</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
              <div>
                <span className="text-sm font-medium text-gray-900">{item.listingId}</span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">{item.status}</Badge>
                  {item.autoUpdate && (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">{t("autoUpdate")}</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {t("installedAt")}: {new Date(item.installedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm"><Settings size={14} /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleUninstall(item.id)}>
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
