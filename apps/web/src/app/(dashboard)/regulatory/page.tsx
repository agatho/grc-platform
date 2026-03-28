"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Shield, Calendar, FileText, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RegulatoryChangeDashboard } from "@grc/shared";

const CLASSIFICATION_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  major: "bg-orange-100 text-orange-700",
  minor: "bg-yellow-100 text-yellow-700",
  informational: "bg-blue-100 text-blue-700",
};

export default function RegulatoryDashboardPage() {
  const t = useTranslations("regulatory");
  const [data, setData] = useState<RegulatoryChangeDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/regulatory-changes/dashboard");
      if (res.ok) setData((await res.json()).data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

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
        <div className="flex gap-2">
          <Link href="/regulatory/sources"><Button variant="outline">{t("manageSources")}</Button></Link>
          <Link href="/regulatory/calendar"><Button variant="outline"><Calendar className="h-4 w-4 mr-2" />{t("calendar")}</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("activeSources")}</p><p className="text-2xl font-bold">{data.activeSources}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("totalChanges")}</p><p className="text-2xl font-bold">{data.totalChanges}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("newChanges")}</p><p className="text-2xl font-bold text-blue-600">{data.newChanges}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("criticalChanges")}</p><p className="text-2xl font-bold text-red-600">{data.criticalChanges}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t("pendingAssessments")}</p><p className="text-2xl font-bold text-orange-600">{data.pendingAssessments}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>{t("recentChanges")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentChanges.map((change) => (
                <Link key={change.id} href={`/regulatory/changes?id=${change.id}`} className="block">
                  <div className="p-3 border rounded hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">{change.title}</p>
                      <Badge className={CLASSIFICATION_COLORS[change.classification] ?? ""}>{change.classification}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{change.jurisdiction} - {change.changeType}</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("upcomingDeadlines")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.upcomingDeadlines.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.eventDate}</p>
                    </div>
                  </div>
                  <Badge variant={event.priority === "critical" ? "destructive" : "outline"}>{event.priority}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
