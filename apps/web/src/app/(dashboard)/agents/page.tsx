"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Bot, Play, Settings, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentDashboard } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-green-100 text-green-900",
  running: "bg-blue-100 text-blue-900",
  error: "bg-red-100 text-red-900",
  disabled: "bg-gray-100 text-gray-500",
};

const AGENT_ICONS: Record<string, string> = {
  evidence_review: "🔍",
  compliance_monitor: "📋",
  vendor_signal: "🏢",
  sla_monitor: "⏰",
};

export default function AgentDashboardPage() {
  const t = useTranslations("agents");
  const [data, setData] = useState<AgentDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/agents/dashboard");
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

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("dashboard")}</p>
        </div>
        <Link href="/agents/recommendations">
          <Button variant="outline">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {t("openRecommendations")} ({data.pendingRecommendations})
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("activeAgents")}</p>
            <p className="text-2xl font-bold">
              {data.activeAgents} / {data.totalAgents}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("lastScan")}</p>
            <p className="text-2xl font-bold">
              {data.lastScanAt
                ? new Date(data.lastScanAt).toLocaleString()
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t("openRecommendations")}
            </p>
            <p className="text-2xl font-bold">{data.pendingRecommendations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              {t("criticalAlerts")}
            </p>
            <p className="text-2xl font-bold text-red-600">
              {data.criticalAlerts}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-2 gap-4">
        {data.agents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>{AGENT_ICONS[agent.agentType] ?? "🤖"}</span>
                  {agent.name}
                </CardTitle>
                <Badge className={STATUS_COLORS[agent.status] ?? ""}>
                  {t(`status.${agent.status}` as any)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {agent.description}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span>
                  {t("log.itemsFound")}: {agent.totalRunCount} runs
                </span>
                <span>
                  {agent.totalRecommendations}{" "}
                  {t("recommendations.title").toLowerCase()}
                </span>
              </div>
              <div className="flex gap-2">
                <Link href={`/agents/${agent.id}`}>
                  <Button size="sm" variant="outline">
                    <Settings className="h-3 w-3 mr-1" />
                    {t("configure")}
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await fetch(`/api/v1/agents/${agent.id}/run`, {
                      method: "POST",
                    });
                    fetchData();
                  }}
                >
                  <Play className="h-3 w-3 mr-1" />
                  {t("runNow")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
