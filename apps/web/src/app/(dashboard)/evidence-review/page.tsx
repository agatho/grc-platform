"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { FileSearch, Plus, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvidenceReviewDashboard } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-900",
  running: "bg-blue-100 text-blue-900",
  completed: "bg-green-100 text-green-900",
  failed: "bg-red-100 text-red-900",
  cancelled: "bg-gray-100 text-gray-500",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-900",
  high: "bg-orange-100 text-orange-900",
  medium: "bg-yellow-100 text-yellow-900",
  low: "bg-blue-100 text-blue-900",
};

export default function EvidenceReviewPage() {
  const t = useTranslations("evidenceReview");
  const [data, setData] = useState<EvidenceReviewDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/evidence-review/dashboard");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const createJob = async () => {
    const res = await fetch("/api/v1/evidence-review/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Full Evidence Review", scope: "all" }),
    });
    if (res.ok) await fetchData();
  };

  if (loading || !data) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={createJob}>
          <Plus className="h-4 w-4 mr-2" />
          {t("newJob")}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("totalReviewed")}</p>
            <p className="text-2xl font-bold">{data.summary.totalArtifactsReviewed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("compliant")}</p>
            <p className="text-2xl font-bold text-green-600">{data.summary.totalCompliant}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("nonCompliant")}</p>
            <p className="text-2xl font-bold text-red-600">{data.summary.totalNonCompliant}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("openGaps")}</p>
            <p className="text-2xl font-bold text-orange-600">{data.summary.openGaps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("avgConfidence")}</p>
            <p className="text-2xl font-bold">{Number(data.summary.avgConfidence).toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>{t("recentJobs")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.recentJobs.map((job) => (
              <Link key={job.id} href={`/evidence-review/${job.id}`} className="block">
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <FileSearch className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{job.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.reviewedArtifacts}/{job.totalArtifacts} {t("artifacts")}
                      </p>
                    </div>
                  </div>
                  <Badge className={STATUS_COLORS[job.status] ?? ""}>
                    {t(`status.${job.status}`)}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Gaps */}
      {data.topGaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("topGaps")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topGaps.map((gap) => (
                <div key={gap.id} className="flex items-center justify-between p-2 rounded border">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">{gap.title}</span>
                  </div>
                  <Badge className={SEVERITY_COLORS[gap.severity] ?? ""}>
                    {gap.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
