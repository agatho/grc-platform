"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, FileSearch, FileCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";

export default function AuditorDashboardPage() {
  const t = useTranslations("roleDashboards");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/role-dashboards/data/auditor")
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const evidence = data.evidenceQuality as Record<string, number> | undefined;
  const findingsByAge = data.findingsByAge as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("auditorDashboard")}</h1>
        <p className="text-muted-foreground">{t("auditorDescription")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("totalEvidence")}</CardDescription>
            <CardTitle className="text-2xl">{evidence?.total_evidence ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{t("withAttachment")}: {evidence?.with_attachment ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("recentEvidence")}</CardDescription>
            <CardTitle className="text-2xl text-green-600">{evidence?.recent_evidence ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{t("last90Days")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("findingsByAge")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {findingsByAge?.map((bucket, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span>{String(bucket.age_bucket)}</span>
                <Badge variant="outline">{String(bucket.count)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
