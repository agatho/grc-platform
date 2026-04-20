"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw, Plus, ShieldCheck } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/marketplace/publishers");
      if (res.ok) setPublishers((await res.json()).data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
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
