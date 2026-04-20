"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw, GitCompare } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";

interface Comparison {
  id: string;
  name: string;
  description: string | null;
  scenarioIds: string[];
  createdAt: string;
}

export default function ComparisonsPage() {
  return (
    <ModuleGate moduleKey="simulations">
      <ComparisonsList />
    </ModuleGate>
  );
}

function ComparisonsList() {
  const t = useTranslations("simulations");
  const [items, setItems] = useState<Comparison[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/simulations/comparisons");
      if (res.ok) setItems((await res.json()).data ?? []);
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
            {t("comparisonsTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("comparisonsDescription")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {t("noComparisons")}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center gap-2">
                <GitCompare size={14} className="text-purple-500" />
                <span className="text-sm font-medium text-gray-900">
                  {c.name}
                </span>
                <span className="text-xs text-gray-400">
                  ({c.scenarioIds.length} {t("scenarios")})
                </span>
              </div>
              {c.description && (
                <p className="text-xs text-gray-500 mt-1">{c.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
