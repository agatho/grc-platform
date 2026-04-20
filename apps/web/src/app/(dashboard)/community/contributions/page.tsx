"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw, Code, GitPullRequest } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Contribution {
  id: string;
  contributionType: string;
  title: string;
  description: string | null;
  repositoryUrl: string | null;
  prUrl: string | null;
  status: string;
  createdAt: string;
}

export default function ContributionsPage() {
  return (
    <ModuleGate moduleKey="community">
      <ContributionsList />
    </ModuleGate>
  );
}

function ContributionsList() {
  const t = useTranslations("community");
  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/community/contributions?limit=50");
      if (res.ok) setItems((await res.json()).data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const statusColors: Record<string, string> = {
    submitted: "bg-blue-50 text-blue-700",
    under_review: "bg-yellow-50 text-yellow-700",
    accepted: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-700",
    merged: "bg-purple-50 text-purple-700",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("contributionsTitle")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("contributionsDescription")}
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
          {t("noContributions")}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center gap-2">
                <Code size={14} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-900">
                  {c.title}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant="outline"
                  className={statusColors[c.status] ?? ""}
                >
                  {c.status.replace(/_/g, " ")}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {c.contributionType.replace(/_/g, " ")}
                </Badge>
                <span className="text-xs text-gray-400">
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>
              {c.description && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                  {c.description}
                </p>
              )}
              {c.prUrl && (
                <a
                  href={c.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800"
                >
                  <GitPullRequest size={12} /> {t("viewPR")}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
