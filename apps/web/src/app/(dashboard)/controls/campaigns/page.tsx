"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, RefreshCcw, ClipboardList } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CampaignStatus } from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignRow {
  id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  periodStart: string;
  periodEnd: string;
  responsibleName?: string;
  totalTests: number;
  completedTests: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeClass(status: CampaignStatus): string {
  const map: Record<CampaignStatus, string> = {
    draft: "bg-gray-100 text-gray-700 border-gray-200",
    active: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CampaignsPage() {
  return (
    <ModuleGate moduleKey="ics">
      <ModuleTabNav />
      <CampaignsPageInner />
    </ModuleGate>
  );
}

function CampaignsPageInner() {
  const t = useTranslations("controls");
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/controls/campaigns?limit=100");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setCampaigns(json.data ?? []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

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
          <h1 className="text-2xl font-bold text-gray-900">{t("campaigns.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("campaigns.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchCampaigns()} disabled={loading}>
            <RefreshCcw size={14} />
          </Button>
          <Button size="sm">
            <Plus size={16} />
            {t("campaigns.create")}
          </Button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <ClipboardList size={28} className="text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-500">{t("campaigns.empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const pct = c.totalTests > 0 ? Math.round((c.completedTests / c.totalTests) * 100) : 0;
            return (
              <Link key={c.id} href={`/controls/campaigns/${c.id}`}>
                <Card className="hover:border-blue-300 transition-colors cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-700 hover:text-blue-900">{c.name}</span>
                        <Badge variant="outline" className={statusBadgeClass(c.status)}>
                          {t(`campaigns.status.${c.status}`)}
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDate(c.periodStart)} - {formatDate(c.periodEnd)}
                      </span>
                    </div>
                    {c.description && (
                      <p className="text-xs text-gray-500 mb-2">{c.description}</p>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 shrink-0">
                        {c.completedTests}/{c.totalTests} ({pct}%)
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
