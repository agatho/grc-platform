"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  Play,
  Square,
  FileText,
  Users,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  ChevronLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  RcsaCampaignWithStats,
  RcsaResult,
  RcsaDiscrepancy,
  RcsaAssignmentWithEntity,
  RcsaCompletionEntry,
} from "@grc/shared";

type Tab = "overview" | "results" | "discrepancies" | "participants" | "trend";

export default function CampaignDetailPage() {
  const t = useTranslations("rcsa");
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [campaign, setCampaign] = useState<
    | (RcsaCampaignWithStats & { overdueCount?: number; pendingCount?: number })
    | null
  >(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Results tab
  const [result, setResult] = useState<RcsaResult | null>(null);

  // Discrepancies tab
  const [discrepancies, setDiscrepancies] = useState<
    (RcsaDiscrepancy & { entityTitle?: string })[]
  >([]);

  // Participants tab
  const [completion, setCompletion] = useState<RcsaCompletionEntry[]>([]);

  // Trend tab
  const [trend, setTrend] = useState<{
    current: RcsaResult;
    previous: RcsaResult | null;
    previousCampaignName: string | null;
    deltas: Record<string, number>;
    hasPreviousData: boolean;
  } | null>(null);

  const fetchCampaign = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/rcsa/campaigns/${id}`);
      if (res.ok) {
        const json = await res.json();
        setCampaign(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchCampaign();
  }, [fetchCampaign]);

  const fetchTabData = useCallback(async () => {
    if (!campaign) return;

    if (
      activeTab === "results" &&
      (campaign.status === "closed" || campaign.status === "archived")
    ) {
      const res = await fetch(`/api/v1/rcsa/campaigns/${id}/results`);
      if (res.ok) {
        const json = await res.json();
        setResult(json.data);
      }
    }

    if (
      activeTab === "discrepancies" &&
      (campaign.status === "closed" || campaign.status === "archived")
    ) {
      const res = await fetch(`/api/v1/rcsa/campaigns/${id}/discrepancies`);
      if (res.ok) {
        const json = await res.json();
        setDiscrepancies(json.data ?? []);
      }
    }

    if (activeTab === "participants") {
      const res = await fetch(`/api/v1/rcsa/campaigns/${id}/completion`);
      if (res.ok) {
        const json = await res.json();
        setCompletion(json.data ?? []);
      }
    }

    if (
      activeTab === "trend" &&
      (campaign.status === "closed" || campaign.status === "archived")
    ) {
      const res = await fetch(`/api/v1/rcsa/campaigns/${id}/trend`);
      if (res.ok) {
        const json = await res.json();
        setTrend(json.data);
      }
    }
  }, [id, activeTab, campaign]);

  useEffect(() => {
    void fetchTabData();
  }, [fetchTabData]);

  const handleLaunch = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/rcsa/campaigns/${id}/launch`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchCampaign();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/rcsa/campaigns/${id}/close`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchCampaign();
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !campaign) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-16 text-gray-500">
        {t("campaign.notFound")}
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    active: "bg-blue-100 text-blue-900",
    closed: "bg-green-100 text-green-900",
    archived: "bg-gray-200 text-gray-500",
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "overview",
      label: t("tab.overview"),
      icon: <BarChart3 size={14} />,
    },
    { key: "results", label: t("tab.results"), icon: <FileText size={14} /> },
    {
      key: "discrepancies",
      label: t("tab.discrepancies"),
      icon: <AlertTriangle size={14} />,
    },
    {
      key: "participants",
      label: t("tab.participants"),
      icon: <Users size={14} />,
    },
    { key: "trend", label: t("tab.trend"), icon: <TrendingUp size={14} /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/rcsa")}
          className="mb-2"
        >
          <ChevronLeft size={14} className="mr-1" />
          {t("campaign.backToList")}
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {campaign.name}
              </h1>
              <Badge
                variant="outline"
                className={statusColors[campaign.status] ?? ""}
              >
                {t(`campaign.status.${campaign.status}`)}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {campaign.periodStart} - {campaign.periodEnd}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchCampaign}>
              <RefreshCcw size={14} />
            </Button>
            {campaign.status === "draft" && (
              <Button size="sm" onClick={handleLaunch} disabled={actionLoading}>
                {actionLoading ? (
                  <Loader2 size={14} className="animate-spin mr-1" />
                ) : (
                  <Play size={14} className="mr-1" />
                )}
                {t("campaign.launch")}
              </Button>
            )}
            {campaign.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleClose}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 size={14} className="animate-spin mr-1" />
                ) : (
                  <Square size={14} className="mr-1" />
                )}
                {t("campaign.close")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Completion gauge */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={t("kpi.participationRate")}
          value={`${campaign.completionRate}%`}
        />
        <KpiCard
          label={t("kpi.totalAssignments")}
          value={String(campaign.totalAssignments)}
        />
        <KpiCard
          label={t("kpi.completed")}
          value={String(campaign.completedCount)}
        />
        <KpiCard
          label={t("kpi.overdue")}
          value={String(campaign.overdueCount ?? 0)}
          highlight={(campaign.overdueCount ?? 0) > 0}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && (
          <div className="space-y-4">
            {campaign.description && (
              <p className="text-sm text-gray-600">{campaign.description}</p>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border p-4">
                <span className="text-gray-500">
                  {t("campaign.frequency")}:
                </span>
                <p className="font-medium mt-1">
                  {t(`campaign.freq.${campaign.frequency}`)}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <span className="text-gray-500">
                  {t("campaign.cesWeight")}:
                </span>
                <p className="font-medium mt-1">{campaign.cesWeight}%</p>
              </div>
              <div className="rounded-lg border p-4">
                <span className="text-gray-500">
                  {t("campaign.participants")}:
                </span>
                <p className="font-medium mt-1">{campaign.participantCount}</p>
              </div>
              <div className="rounded-lg border p-4">
                <span className="text-gray-500">
                  {t("campaign.reminderDays")}:
                </span>
                <p className="font-medium mt-1">
                  {campaign.reminderDaysBefore} {t("common.days")}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "results" && (
          <div>
            {!result ? (
              <p className="text-sm text-gray-500 text-center py-8">
                {t("results.notAvailable")}
              </p>
            ) : (
              <div className="space-y-6">
                {/* Risk Summary */}
                <div className="rounded-lg border p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    {t("results.riskSummary")}
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">
                        {t("results.avgLikelihood")}:
                      </span>
                      <p className="font-medium text-lg">
                        {result.avgLikelihood ?? "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("results.avgImpact")}:
                      </span>
                      <p className="font-medium text-lg">
                        {result.avgImpact ?? "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("results.riskTrend")}:
                      </span>
                      <div className="flex gap-2 mt-1">
                        <Badge className="bg-red-100 text-red-900">
                          {result.risksIncreasing} {t("results.increasing")}
                        </Badge>
                        <Badge className="bg-gray-100 text-gray-700">
                          {result.risksStable} {t("results.stable")}
                        </Badge>
                        <Badge className="bg-green-100 text-green-900">
                          {result.risksDecreasing} {t("results.decreasing")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Control Summary */}
                <div className="rounded-lg border p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    {t("results.controlSummary")}
                  </h3>
                  <div className="flex gap-4">
                    <div className="flex-1 rounded-lg bg-green-50 p-3 text-center">
                      <p className="text-2xl font-bold text-green-700">
                        {result.controlsEffective}
                      </p>
                      <p className="text-xs text-green-600">
                        {t("results.effective")}
                      </p>
                    </div>
                    <div className="flex-1 rounded-lg bg-yellow-50 p-3 text-center">
                      <p className="text-2xl font-bold text-yellow-700">
                        {result.controlsPartial}
                      </p>
                      <p className="text-xs text-yellow-600">
                        {t("results.partial")}
                      </p>
                    </div>
                    <div className="flex-1 rounded-lg bg-red-50 p-3 text-center">
                      <p className="text-2xl font-bold text-red-700">
                        {result.controlsIneffective}
                      </p>
                      <p className="text-xs text-red-600">
                        {t("results.ineffective")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "discrepancies" && (
          <div>
            {discrepancies.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                {t("discrepancies.empty")}
              </p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-medium text-gray-600">
                        {t("discrepancies.entity")}
                      </th>
                      <th className="text-left p-3 font-medium text-gray-600">
                        {t("discrepancies.rcsaRating")}
                      </th>
                      <th className="text-left p-3 font-medium text-gray-600">
                        {t("discrepancies.auditRating")}
                      </th>
                      <th className="text-left p-3 font-medium text-gray-600">
                        {t("discrepancies.type")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {discrepancies.map((d, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-3">{d.entityTitle ?? d.entityId}</td>
                        <td className="p-3">
                          <Badge variant="outline">{d.rcsaRating}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{d.auditRating}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge
                            className={
                              d.type === "overconfident"
                                ? "bg-red-100 text-red-900"
                                : "bg-orange-100 text-orange-900"
                            }
                          >
                            {t(`discrepancies.${d.type}`)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "participants" && (
          <div>
            {completion.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                {t("participants.empty")}
              </p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-medium text-gray-600">
                        {t("participants.name")}
                      </th>
                      <th className="text-left p-3 font-medium text-gray-600">
                        {t("participants.assigned")}
                      </th>
                      <th className="text-left p-3 font-medium text-gray-600">
                        {t("participants.completed")}
                      </th>
                      <th className="text-left p-3 font-medium text-gray-600">
                        {t("participants.overdue")}
                      </th>
                      <th className="text-left p-3 font-medium text-gray-600">
                        {t("participants.lastActivity")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {completion.map((entry) => (
                      <tr key={entry.userId} className="border-t">
                        <td className="p-3">
                          <div>
                            <p className="font-medium">{entry.userName}</p>
                            <p className="text-xs text-gray-500">
                              {entry.userEmail}
                            </p>
                          </div>
                        </td>
                        <td className="p-3">{entry.assignedCount}</td>
                        <td className="p-3">{entry.completedCount}</td>
                        <td className="p-3">
                          {entry.overdueCount > 0 ? (
                            <Badge className="bg-red-100 text-red-900">
                              {entry.overdueCount}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="p-3 text-gray-500">
                          {entry.lastActivity
                            ? new Date(entry.lastActivity).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "trend" && (
          <div>
            {!trend?.hasPreviousData ? (
              <p className="text-sm text-gray-500 text-center py-8">
                {t("trend.noData")}
              </p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  {t("trend.comparingWith")}:{" "}
                  <strong>{trend.previousCampaignName}</strong>
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <DeltaCard
                    label={t("trend.completionRate")}
                    delta={trend.deltas.completionRate}
                    unit="%"
                  />
                  <DeltaCard
                    label={t("trend.avgLikelihood")}
                    delta={trend.deltas.avgLikelihood}
                    inverted
                  />
                  <DeltaCard
                    label={t("trend.avgImpact")}
                    delta={trend.deltas.avgImpact}
                    inverted
                  />
                  <DeltaCard
                    label={t("trend.controlsEffective")}
                    delta={trend.deltas.controlsEffective}
                  />
                  <DeltaCard
                    label={t("trend.discrepancies")}
                    delta={trend.deltas.discrepancyCount}
                    inverted
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${highlight ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`}
    >
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p
        className={`text-2xl font-bold mt-1 ${highlight ? "text-red-700" : "text-gray-900"}`}
      >
        {value}
      </p>
    </div>
  );
}

function DeltaCard({
  label,
  delta,
  unit,
  inverted,
}: {
  label: string;
  delta: number;
  unit?: string;
  inverted?: boolean;
}) {
  const isPositive = inverted ? delta < 0 : delta > 0;
  const isNeutral = delta === 0;

  return (
    <div className="rounded-lg border border-gray-200 p-4 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p
        className={`text-lg font-bold ${
          isNeutral
            ? "text-gray-500"
            : isPositive
              ? "text-green-600"
              : "text-red-600"
        }`}
      >
        {delta > 0 ? "+" : ""}
        {Math.round(delta * 100) / 100}
        {unit ?? ""}
      </p>
    </div>
  );
}
