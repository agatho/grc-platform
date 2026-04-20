"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  Plus,
  ClipboardCheck,
  Users,
  AlertTriangle,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RcsaCampaignWithStats } from "@grc/shared";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";

export default function RcsaCampaignsPage() {
  const t = useTranslations("rcsa");
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<RcsaCampaignWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");
      const res = await fetch(`/api/v1/rcsa/campaigns?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setCampaigns(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    active: "bg-blue-100 text-blue-900",
    closed: "bg-green-100 text-green-900",
    archived: "bg-gray-200 text-gray-500",
  };

  return (
    <div className="space-y-6">
      <ModuleTabNav />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCampaigns}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={() => router.push("/rcsa/campaigns/new")}>
            <Plus size={14} className="mr-1" />
            {t("campaign.create")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {["", "draft", "active", "closed", "archived"].map((status) => (
          <Button
            key={status || "all"}
            variant={statusFilter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(status)}
          >
            {status ? t(`campaign.status.${status}`) : t("campaign.statusAll")}
          </Button>
        ))}
      </div>

      {/* Campaign Grid */}
      {loading && campaigns.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardCheck className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-sm text-gray-500">{t("campaign.empty")}</p>
          <Button
            className="mt-4"
            onClick={() => router.push("/rcsa/campaigns/new")}
          >
            <Plus size={14} className="mr-1" />
            {t("campaign.create")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href={`/rcsa/campaigns/${campaign.id}`}
              className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm truncate pr-2">
                  {campaign.name}
                </h3>
                <Badge
                  variant="outline"
                  className={statusColors[campaign.status] ?? ""}
                >
                  {t(`campaign.status.${campaign.status}`)}
                </Badge>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                {campaign.periodStart} - {campaign.periodEnd}
              </p>

              {/* Completion donut */}
              <div className="flex items-center gap-4 mb-3">
                <div className="relative w-14 h-14">
                  <svg viewBox="0 0 36 36" className="w-14 h-14">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke={
                        campaign.completionRate >= 80
                          ? "#22c55e"
                          : campaign.completionRate >= 50
                            ? "#eab308"
                            : "#ef4444"
                      }
                      strokeWidth="3"
                      strokeDasharray={`${campaign.completionRate}, 100`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    {campaign.completionRate}%
                  </span>
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Users size={12} />
                    <span>
                      {campaign.participantCount} {t("campaign.participants")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-600">
                    <ClipboardCheck size={12} />
                    <span>
                      {campaign.completedCount}/{campaign.totalAssignments}{" "}
                      {t("campaign.completed")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deadline info */}
              {campaign.status === "active" && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={12} />
                  <span>
                    {t("campaign.deadline")}: {campaign.periodEnd}
                  </span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
