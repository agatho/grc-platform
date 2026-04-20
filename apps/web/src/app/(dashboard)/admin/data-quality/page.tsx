"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Clock,
  AlertTriangle,
  XCircle,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataQualityStats {
  activeRules: number;
  lastCheck: string | null;
  errorRate: number;
  openViolations: number;
}

interface DataQualityRule {
  id: string;
  name: string;
  entityType: string;
  field: string;
  ruleType: "range" | "pattern" | "required" | "unique";
  severity: "low" | "medium" | "high" | "critical";
  status: "active" | "inactive";
  violationCount: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
};

const statusLabels: Record<string, string> = {
  active: "Aktiv",
  inactive: "Inaktiv",
};

const severityColors: Record<string, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const severityLabels: Record<string, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  critical: "Kritisch",
};

const ruleTypeLabels: Record<string, string> = {
  range: "Wertebereich",
  pattern: "Muster",
  required: "Pflichtfeld",
  unique: "Eindeutig",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DataQualityPage() {
  const [stats, setStats] = useState<DataQualityStats | null>(null);
  const [rules, setRules] = useState<DataQualityRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/data-quality/rules");
      if (res.ok) {
        const json = await res.json();
        setRules(json.data ?? []);
        setStats(json.stats ?? null);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Datenqualit&auml;tsregeln
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Automatische Plausibilit&auml;tspr&uuml;fungen auf eingegebene Daten
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Aktualisieren
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Regel erstellen
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.activeRules ?? 0}</p>
                <p className="text-xs text-gray-500">Aktive Regeln</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {stats?.lastCheck
                    ? new Date(stats.lastCheck).toLocaleDateString("de-DE")
                    : "\u2014"}
                </p>
                <p className="text-xs text-gray-500">Letzte Pr&uuml;fung</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {stats?.errorRate != null
                    ? `${stats.errorRate.toFixed(1)}%`
                    : "\u2014"}
                </p>
                <p className="text-xs text-gray-500">Fehlerquote</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">
                  {stats?.openViolations ?? 0}
                </p>
                <p className="text-xs text-gray-500">
                  Verst&ouml;&szlig;e offen
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Validierungsregeln ({rules.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-400">
              <CheckCircle2 className="mb-3 h-10 w-10" />
              <p className="font-medium text-gray-500">
                Keine Regeln konfiguriert
              </p>
              <p className="mt-1 text-gray-400">
                Definieren Sie Plausibilit&auml;tspr&uuml;fungen f&uuml;r Ihre
                Dateneingaben.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Entit&auml;tstyp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Feld
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Regeltyp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Schweregrad
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Verst&ouml;&szlig;e
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {rule.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {rule.entityType}
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                          {rule.field}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {ruleTypeLabels[rule.ruleType] ?? rule.ruleType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`text-xs ${severityColors[rule.severity] ?? ""}`}
                        >
                          {severityLabels[rule.severity] ?? rule.severity}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {rule.violationCount > 0 ? (
                          <span className="font-medium text-red-600">
                            {rule.violationCount}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          className={
                            statusColors[rule.status] ??
                            "bg-gray-100 text-gray-800"
                          }
                        >
                          {statusLabels[rule.status] ?? rule.status}
                        </Badge>
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
