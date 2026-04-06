"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComplianceRow {
  documentId: string;
  documentTitle: string;
  totalUsers: number;
  acknowledgedCount: number;
  pct: number;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CompliancePage() {
  return (
    <ModuleGate moduleKey="dms">
      <CompliancePageInner />
    </ModuleGate>
  );
}

function CompliancePageInner() {
  const t = useTranslations("documents");
  const [rows, setRows] = useState<ComplianceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/documents/compliance");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setRows(json.data ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Aggregate metrics
  const totalDocs = rows.length;
  const fullyCompliant = rows.filter((r) => r.pct >= 100).length;
  const avgPct = rows.length > 0
    ? Math.round(rows.reduce((sum, r) => sum + r.pct, 0) / rows.length)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("compliance.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("compliance.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading}>
          <RefreshCcw size={14} />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
              <FileText size={20} className="text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalDocs}</p>
              <p className="text-xs text-gray-500">{t("compliance.totalDocuments")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{fullyCompliant}</p>
              <p className="text-xs text-gray-500">{t("compliance.fullyCompliant")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <CheckCircle2 size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{avgPct}%</p>
              <p className="text-xs text-gray-500">{t("compliance.averageRate")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-document table */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <CheckCircle2 size={28} className="text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-500">{t("compliance.empty")}</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("compliance.perDocument")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase">
                    <th className="pb-2 pr-4">{t("form.title")}</th>
                    <th className="pb-2 pr-4">{t("compliance.acknowledged")}</th>
                    <th className="pb-2 pr-4">{t("compliance.total")}</th>
                    <th className="pb-2">{t("compliance.rate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.documentId} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/documents/${row.documentId}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          {row.documentTitle}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{row.acknowledgedCount}</td>
                      <td className="py-2 pr-4 text-gray-700">{row.totalUsers}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.pct >= 80
                                  ? "bg-emerald-500"
                                  : row.pct >= 50
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                              }`}
                              style={{ width: `${row.pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-600">{row.pct}%</span>
                          {row.pct < 50 && (
                            <AlertTriangle size={12} className="text-red-500" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
