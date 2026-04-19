"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  Shield,
  HeartPulse,
  Scale,
  Brain,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  RouteOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type HealthStatus = "green" | "amber" | "red";

interface ModuleHealth {
  module: "isms" | "bcms" | "dpms" | "ai_act";
  score: number;
  status: HealthStatus;
  driverMetrics: Record<string, number>;
  topConcerns: string[];
}

interface ExecutiveDashboardResponse {
  asOfDate: string;
  organizationName: string;
  overallScore: number;
  overallStatus: HealthStatus;
  modules: ModuleHealth[];
  criticalCount: number;
  amberCount: number;
  boardBriefingTalkingPoints: string[];
  topExecutiveActions: string[];
}

const MODULE_META: Record<
  ModuleHealth["module"],
  { label: string; icon: typeof Shield; hrefDashboard: string }
> = {
  isms: { label: "Information Security", icon: Shield, hrefDashboard: "/isms" },
  bcms: { label: "Business Continuity", icon: HeartPulse, hrefDashboard: "/bcms" },
  dpms: { label: "Data Protection", icon: Scale, hrefDashboard: "/data-privacy" },
  ai_act: { label: "EU AI Act", icon: Brain, hrefDashboard: "/ai-act" },
};

function statusBadge(status: HealthStatus) {
  const variants: Record<HealthStatus, { label: string; className: string }> = {
    green: { label: "GREEN", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    amber: { label: "AMBER", className: "bg-amber-100 text-amber-800 border-amber-300" },
    red: { label: "RED", className: "bg-red-100 text-red-800 border-red-300" },
  };
  const v = variants[status];
  return (
    <Badge variant="outline" className={v.className}>
      {v.label}
    </Badge>
  );
}

function scoreBar(score: number, status: HealthStatus) {
  const color =
    status === "green"
      ? "bg-emerald-500"
      : status === "amber"
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div className={`${color} h-full transition-all`} style={{ width: `${score}%` }} />
    </div>
  );
}

export default function GrcCompositeDashboardPage() {
  const [data, setData] = useState<ExecutiveDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/cross/executive-dashboard");
      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium">Dashboard konnte nicht geladen werden</p>
            </div>
            <p className="text-sm text-red-700 mt-2">{error}</p>
            <Button onClick={fetchData} className="mt-4" variant="outline">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">GRC Executive Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {data.organizationName} — Stand: {data.asOfDate}
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCcw className="h-4 w-4 mr-2" />
          Aktualisieren
        </Button>
      </div>

      {/* Overall Health */}
      <Card
        className={
          data.overallStatus === "red"
            ? "border-red-300 bg-red-50/30 dark:bg-red-950/10"
            : data.overallStatus === "amber"
              ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10"
              : "border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/10"
        }
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Overall GRC Health</CardTitle>
              <CardDescription>
                Durchschnitt ueber ISMS, BCMS, DPMS und AI-Act (gleichgewichtet).
              </CardDescription>
            </div>
            {statusBadge(data.overallStatus)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold">{data.overallScore}</span>
            <span className="text-muted-foreground">/ 100</span>
          </div>
          <Progress value={data.overallScore} className="h-3" />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="font-medium">{data.criticalCount}</span>
              <span className="text-muted-foreground">Modul(e) RED</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="font-medium">{data.amberCount}</span>
              <span className="text-muted-foreground">Modul(e) AMBER</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.modules.map((m) => {
          const meta = MODULE_META[m.module];
          const Icon = meta.icon;
          return (
            <Card key={m.module}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{meta.label}</CardTitle>
                  </div>
                  {statusBadge(m.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{m.score}</span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
                {scoreBar(m.score, m.status)}

                {/* Drivers */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                  {Object.entries(m.driverMetrics)
                    .slice(0, 6)
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between border-b py-1">
                        <span className="text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, " $1")}
                        </span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                </div>

                {/* Concerns */}
                {m.topConcerns.length > 0 && (
                  <div className="pt-2 space-y-1">
                    {m.topConcerns.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-xs text-muted-foreground"
                      >
                        <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-600 flex-shrink-0" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Link
                  href={meta.hrefDashboard}
                  className="text-xs text-primary hover:underline inline-block pt-2"
                >
                  Details ansehen &rarr;
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Top Executive Actions */}
      {data.topExecutiveActions.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <RouteOff className="h-5 w-5 text-red-600" />
              <CardTitle>Top 3 Executive Actions</CardTitle>
            </div>
            <CardDescription>
              Priorisierte Massnahmen aus kritischen Modulen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {data.topExecutiveActions.map((action, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm">{action}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Board Briefing */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            <CardTitle>Board Briefing Talking Points</CardTitle>
          </div>
          <CardDescription>
            Kopierbare Punkte fuer das Vorstandsmeeting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.boardBriefingTalkingPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 flex-shrink-0" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
