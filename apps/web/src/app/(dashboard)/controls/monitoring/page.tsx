"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Activity, Clock, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MonitoringRule {
  id: string;
  name: string;
  controlRef: string;
  frequency: string;
  lastResult: "pass" | "fail" | "error" | "pending";
  lastRunAt: string | null;
  status: "active" | "paused" | "disabled";
  consecutiveFailures: number;
}

interface MonitoringDashboard {
  activeRules: number;
  lastCheckAt: string | null;
  errorRate: number;
  maxConsecutiveFailures: number;
  rules: MonitoringRule[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ControlMonitoringPage() {
  return (
    <ModuleGate moduleKey="ics">
      <ControlMonitoringInner />
    </ModuleGate>
  );
}

function ControlMonitoringInner() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MonitoringDashboard | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/controls/monitoring/rules");
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rules = data?.rules ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kontinuierliche Kontroll\u00fcberwachung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automatisierte Pr\u00fcfregeln f\u00fcr Kontrollwirksamkeit
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Regel erstellen
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              Aktive Regeln
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data?.activeRules ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-600" />
              Letzte Pr\u00fcfung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {data?.lastCheckAt
                ? new Date(data.lastCheckAt).toLocaleString("de-DE")
                : "--"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Fehlerquote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data?.errorRate != null ? `${(data.errorRate * 100).toFixed(1)}%` : "0%"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Konsekutive Fehler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {data?.maxConsecutiveFailures ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <Card>
        <CardHeader>
          <CardTitle>\u00dcberwachungsregeln</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Keine \u00dcberwachungsregeln vorhanden. Erstellen Sie Ihre erste Regel.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Kontroll-Referenz</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Frequenz</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Letztes Ergebnis</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 font-medium">{rule.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{rule.controlRef}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{rule.frequency}</td>
                      <td className="px-4 py-3 text-center">
                        <ResultBadge result={rule.lastResult} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={rule.status} />
                      </td>
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

function ResultBadge({ result }: { result: string }) {
  switch (result) {
    case "pass":
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Bestanden
        </Badge>
      );
    case "fail":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Fehlgeschlagen
        </Badge>
      );
    case "error":
      return (
        <Badge variant="secondary">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Fehler
        </Badge>
      );
    default:
      return <Badge variant="outline">Ausstehend</Badge>;
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <Badge variant="default">Aktiv</Badge>;
    case "paused":
      return <Badge variant="secondary">Pausiert</Badge>;
    case "disabled":
      return <Badge variant="outline">Deaktiviert</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
