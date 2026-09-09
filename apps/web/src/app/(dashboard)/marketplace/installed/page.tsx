"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw, Trash2, Settings } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDateFormat } from "@/lib/format-date";

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
  const { formatDate } = useDateFormat();
  // [OP-245 · Gestalt A] Fetch on mount via `@tanstack/react-query` instead
  // of an effect plus mirrored loading/data state (pattern from wave 7b,
  // `catalogs/objects/page.tsx`). A non-ok response yields an empty list, as
  // before; the refresh button follows `isFetching`.
  const {
    data: items = [],
    isPending: loading,
    isFetching,
    refetch,
  } = useQuery<Installation[]>({
    queryKey: ["marketplace", "installations"],
    queryFn: async () => {
      const res = await fetch("/api/v1/marketplace/installations");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as Installation[];
    },
  });

  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleUninstall = async (id: string) => {
    await fetch(`/api/v1/marketplace/installations/${id}`, {
      method: "DELETE",
    });
    void fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("installedTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("installedDescription")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={isFetching}
        >
          <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {t("noInstalled")}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {item.listingId}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">
                    {item.status}
                  </Badge>
                  {item.autoUpdate && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-green-50 text-green-700"
                    >
                      {t("autoUpdate")}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {t("installedAt")}: {formatDate(item.installedAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">
                  <Settings size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUninstall(item.id)}
                >
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
