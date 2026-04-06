"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, ClipboardList } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CampaignStatus, TestResult, TestStatus } from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignDetail {
  id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  periodStart: string;
  periodEnd: string;
  responsibleName?: string;
}

interface CampaignTestRow {
  id: string;
  controlId: string;
  controlTitle: string;
  testType: string;
  status: TestStatus;
  todResult?: TestResult;
  toeResult?: TestResult;
  testerName?: string;
  testDate?: string;
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

function testStatusClass(status: TestStatus): string {
  const map: Record<TestStatus, string> = {
    planned: "bg-gray-100 text-gray-700 border-gray-200",
    in_progress: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

function resultClass(result?: TestResult): string {
  if (!result) return "text-gray-400";
  const map: Record<TestResult, string> = {
    effective: "text-emerald-700 bg-emerald-50",
    ineffective: "text-red-700 bg-red-50",
    partially_effective: "text-yellow-700 bg-yellow-50",
    not_tested: "text-gray-500 bg-gray-50",
  };
  return map[result] ?? "text-gray-400";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CampaignDetailPage() {
  return (
    <ModuleGate moduleKey="ics">
      <CampaignDetailInner />
    </ModuleGate>
  );
}

function CampaignDetailInner() {
  const t = useTranslations("controls");
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [tests, setTests] = useState<CampaignTestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignRes, testsRes] = await Promise.all([
        fetch(`/api/v1/controls/campaigns/${campaignId}`),
        fetch(`/api/v1/controls/campaigns/${campaignId}/tests`),
      ]);
      if (campaignRes.ok) {
        const json = await campaignRes.json();
        setCampaign(json.data ?? null);
      }
      if (testsRes.ok) {
        const json = await testsRes.json();
        setTests(json.data ?? []);
      }
    } catch {
      // handled by null checks
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/controls/campaigns")}>
          <ArrowLeft size={16} />
          {t("backToList")}
        </Button>
        <div className="flex flex-col items-center justify-center py-12">
          <ClipboardList size={32} className="text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">{t("notFound")}</p>
        </div>
      </div>
    );
  }

  const completed = tests.filter((t) => t.status === "completed").length;
  const pct = tests.length > 0 ? Math.round((completed / tests.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/controls/campaigns")}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={statusBadgeClass(campaign.status)}>
              {t(`campaigns.status.${campaign.status}`)}
            </Badge>
            <span className="text-sm text-gray-500">
              {formatDate(campaign.periodStart)} - {formatDate(campaign.periodEnd)}
            </span>
          </div>
        </div>
      </div>

      {campaign.description && (
        <p className="text-sm text-gray-600">{campaign.description}</p>
      )}

      {/* Progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">{t("campaigns.progress")}</span>
            <div className="flex-1 h-3 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-gray-700">
              {completed}/{tests.length} ({pct}%)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Test Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("campaigns.tests")}</CardTitle>
        </CardHeader>
        <CardContent>
          {tests.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">{t("tests.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase">
                    <th className="pb-2 pr-4">{t("form.title")}</th>
                    <th className="pb-2 pr-4">{t("tests.typeLabel")}</th>
                    <th className="pb-2 pr-4">{t("form.status")}</th>
                    <th className="pb-2 pr-4">ToD</th>
                    <th className="pb-2 pr-4">ToE</th>
                    <th className="pb-2 pr-4">{t("tests.tester")}</th>
                    <th className="pb-2">{t("tests.date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((test) => (
                    <tr key={test.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-4 font-medium text-gray-900">{test.controlTitle}</td>
                      <td className="py-2 pr-4 text-gray-600">{t(`tests.type.${test.testType}`)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className={testStatusClass(test.status)}>
                          {t(`tests.status.${test.status}`)}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${resultClass(test.todResult)}`}>
                          {test.todResult ? t(`tests.result.${test.todResult}`) : "\u2014"}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${resultClass(test.toeResult)}`}>
                          {test.toeResult ? t(`tests.result.${test.toeResult}`) : "\u2014"}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{test.testerName ?? "\u2014"}</td>
                      <td className="py-2 text-gray-600">{formatDate(test.testDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
