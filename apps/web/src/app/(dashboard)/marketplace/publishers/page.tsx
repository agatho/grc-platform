"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw, ShieldCheck } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";

interface Publisher {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isVerified: boolean;
  totalEarnings: string;
  createdAt: string;
}

export default function PublishersPage() {
  return (
    <ModuleGate moduleKey="marketplace">
      <PublisherPortal />
    </ModuleGate>
  );
}

function PublisherPortal() {
  const t = useTranslations("marketplace");
  // [OP-245 · Gestalt A] Fetch on mount via `@tanstack/react-query` instead
  // of an effect plus mirrored loading/data state (pattern from wave 7b,
  // `catalogs/objects/page.tsx`). A non-ok response yields an empty list, as
  // before; the refresh button follows `isFetching`.
  const {
    data: publishers = [],
    isPending: loading,
    isFetching,
    refetch,
  } = useQuery<Publisher[]>({
    queryKey: ["marketplace", "publishers"],
    queryFn: async () => {
      const res = await fetch("/api/v1/marketplace/publishers");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as Publisher[];
    },
  });

  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("publisherPortalTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("publisherPortalDescription")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isFetching}
          >
            <RefreshCcw
              size={14}
              className={isFetching ? "animate-spin" : ""}
            />
          </Button>
        </div>
      </div>

      {loading && publishers.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : publishers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {t("noPublishers")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {publishers.map((pub) => (
            <div
              key={pub.id}
              className="rounded-lg border border-gray-200 bg-white p-5"
            >
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  {pub.name}
                </h3>
                {pub.isVerified && (
                  <ShieldCheck size={14} className="text-blue-500" />
                )}
              </div>
              {pub.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {pub.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                <span>
                  {t("slug")}: {pub.slug}
                </span>
                <span>
                  {t("earnings")}: {pub.totalEarnings} EUR
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
