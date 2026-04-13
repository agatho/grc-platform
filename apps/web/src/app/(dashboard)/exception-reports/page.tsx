"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Loader2, Plus, Filter, CheckCircle2,
  XCircle, TrendingUp, TrendingDown, Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ExceptionReport {
  id: string;
  entityType: string;
  exceptionType: string;
  severity: string;
  title: string;
  expectedValue: string | null;
  actualValue: string | null;
  deviation: number | null;
  isResolved: boolean;
  detectedMethod: string;
  createdAt: string;
}

const severityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-900 border-red-300",
  high: "bg-orange-100 text-orange-900 border-orange-300",
  medium: "bg-yellow-100 text-yellow-900 border-yellow-300",
  low: "bg-blue-100 text-blue-900 border-blue-300",
};

const exceptionTypeLabels: Record<string, string> = {
  threshold_breach: "Schwellenwertüberschreitung",
  data_anomaly: "Datenanomalie",
  control_failure: "Kontrollfehler",
  compliance_gap: "Compliance-Lücke",
  deadline_missed: "Fristüberschreitung",
  variance: "Abweichung",
};

export default function ExceptionReportsPage() {
  const [exceptions, setExceptions] = useState<ExceptionReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/exception-reports?limit=50")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => setExceptions(json.data ?? []))
      .catch(() => setExceptions([]))
      .finally(() => setLoading(false));
  }, []);

  const openCount = exceptions.filter((e) => !e.isResolved).length;
  const resolvedCount = exceptions.filter((e) => e.isResolved).length;
  const criticalCount = exceptions.filter((e) => e.severity === "critical" && !e.isResolved).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ausnahmeberichte</h1>
          <p className="text-sm text-gray-500 mt-1">
            Exception Reporting — Anomalien, Schwellenwertüberschreitungen und Kontrollfehler
          </p>
        </div>
        <Button>
          <Plus size={14} className="mr-1.5" />
          Ausnahme melden
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{openCount}</p>
              <p className="text-xs text-gray-500">Offen</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle size={20} className="text-orange-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{criticalCount}</p>
              <p className="text-xs text-gray-500">Kritisch</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 size={20} className="text-green-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{resolvedCount}</p>
              <p className="text-xs text-gray-500">Gelöst</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown size={20} className="text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {exceptions.length > 0 ? Math.round((resolvedCount / exceptions.length) * 100) : 0}%
              </p>
              <p className="text-xs text-gray-500">Lösungsrate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exception List */}
      {exceptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <AlertTriangle size={32} className="text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-500">Keine Ausnahmen gemeldet</p>
          <p className="text-xs text-gray-400 mt-1">Anomalien werden automatisch oder manuell erfasst</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exceptions.map((exc) => (
            <div
              key={exc.id}
              className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors ${
                exc.isResolved ? "border-gray-200 bg-gray-50/50" : "border-gray-200 bg-white hover:border-blue-300"
              }`}
            >
              {exc.isResolved ? (
                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-orange-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${exc.isResolved ? "text-gray-500 line-through" : "text-gray-900"}`}>
                  {exc.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px]">
                    {exceptionTypeLabels[exc.exceptionType] ?? exc.exceptionType}
                  </Badge>
                  <span className="text-[10px] text-gray-400">{exc.entityType}</span>
                </div>
              </div>
              <Badge variant="outline" className={`text-xs ${severityColors[exc.severity] ?? ""}`}>
                {exc.severity}
              </Badge>
              {exc.deviation != null && (
                <span className="text-xs font-mono text-gray-500 shrink-0">
                  {exc.deviation > 0 ? "+" : ""}{exc.deviation}%
                </span>
              )}
              <span className="text-xs text-gray-400 shrink-0">
                {new Date(exc.createdAt).toLocaleDateString("de-DE")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
