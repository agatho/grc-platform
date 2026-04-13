"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Search, Loader2, Plus, GitBranch, AlertTriangle,
  CheckCircle2, Clock, User, Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RCA {
  id: string;
  title: string;
  methodology: string;
  status: string;
  findingId: string | null;
  ownerName: string | null;
  dueDate: string | null;
  rootCausesCount: number;
  createdAt: string;
}

const methodologyLabels: Record<string, string> = {
  "5_why": "5-Why-Analyse",
  fishbone: "Ishikawa-Diagramm",
  fault_tree: "Fehlerbaumanalyse",
  pareto: "Pareto-Analyse",
  fmea: "FMEA",
};

const statusColors: Record<string, string> = {
  open: "bg-red-100 text-red-900 border-red-300",
  in_progress: "bg-yellow-100 text-yellow-900 border-yellow-300",
  completed: "bg-green-100 text-green-900 border-green-300",
  closed: "bg-gray-100 text-gray-900 border-gray-300",
};

export default function RootCauseAnalysisPage() {
  const [analyses, setAnalyses] = useState<RCA[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch RCAs — API may not exist yet, gracefully handle
    fetch("/api/v1/root-cause-analysis?limit=50")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => setAnalyses(json.data ?? []))
      .catch(() => setAnalyses([]))
      .finally(() => setLoading(false));
  }, []);

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
          <h1 className="text-2xl font-bold text-gray-900">Ursachenanalyse</h1>
          <p className="text-sm text-gray-500 mt-1">
            Root Cause Analysis für Feststellungen und Vorfälle — 5-Why, Ishikawa, Fehlerbaum
          </p>
        </div>
        <Button>
          <Plus size={14} className="mr-1.5" />
          Analyse erstellen
        </Button>
      </div>

      {/* Methodology Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(methodologyLabels).map(([key, label]) => (
          <Card key={key} className="text-center">
            <CardContent className="p-4">
              <GitBranch size={20} className="mx-auto text-blue-600 mb-2" />
              <p className="text-xs font-medium text-gray-700">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* RCA List */}
      {analyses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <GitBranch size={32} className="text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-500">Keine Ursachenanalysen vorhanden</p>
          <p className="text-xs text-gray-400 mt-1">Erstellen Sie eine Analyse aus einer Feststellung oder einem Vorfall</p>
        </div>
      ) : (
        <div className="space-y-2">
          {analyses.map((rca) => (
            <div
              key={rca.id}
              className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-blue-300 transition-colors cursor-pointer"
            >
              <GitBranch size={16} className="text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{rca.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px]">{methodologyLabels[rca.methodology] ?? rca.methodology}</Badge>
                  {rca.rootCausesCount > 0 && (
                    <span className="text-[10px] text-gray-400">{rca.rootCausesCount} Ursachen identifiziert</span>
                  )}
                </div>
              </div>
              <Badge variant="outline" className={`text-xs ${statusColors[rca.status] ?? ""}`}>
                {rca.status}
              </Badge>
              {rca.dueDate && (
                <span className="text-xs text-gray-400 shrink-0">
                  <Calendar size={12} className="inline mr-1" />
                  {new Date(rca.dueDate).toLocaleDateString("de-DE")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
