"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  RefreshCcw,
  Upload,
  List,
  LayoutGrid,
  FileText,
  Image,
  File,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Evidence, EvidenceCategory } from "@grc/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function categoryIcon(category: EvidenceCategory) {
  const imageTypes: EvidenceCategory[] = ["screenshot", "photo"];
  if (imageTypes.includes(category)) return <Image size={16} className="text-blue-500" />;
  const docTypes: EvidenceCategory[] = ["document", "report", "certificate"];
  if (docTypes.includes(category)) return <FileText size={16} className="text-emerald-500" />;
  return <File size={16} className="text-gray-500" />;
}

function categoryBadgeClass(category: EvidenceCategory): string {
  const map: Record<string, string> = {
    screenshot: "bg-blue-100 text-blue-800 border-blue-200",
    document: "bg-emerald-100 text-emerald-800 border-emerald-200",
    log_export: "bg-amber-100 text-amber-800 border-amber-200",
    email: "bg-violet-100 text-violet-800 border-violet-200",
    certificate: "bg-teal-100 text-teal-800 border-teal-200",
    report: "bg-indigo-100 text-indigo-800 border-indigo-200",
    photo: "bg-cyan-100 text-cyan-800 border-cyan-200",
    config_export: "bg-orange-100 text-orange-800 border-orange-200",
    other: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return map[category] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString();
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EvidencePage() {
  return (
    <ModuleGate moduleKey="ics">
      <EvidencePageInner />
    </ModuleGate>
  );
}

function EvidencePageInner() {
  const t = useTranslations("controls");
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const fetchEvidence = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/evidence?limit=500");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setEvidence(json.data ?? []);
    } catch {
      setEvidence([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEvidence();
  }, [fetchEvidence]);

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
          <h1 className="text-2xl font-bold text-gray-900">{t("evidence.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("evidence.subtitle")} &mdash; {evidence.length} {t("evidence.items")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-2 py-1 ${viewMode === "list" ? "bg-slate-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-2 py-1 ${viewMode === "grid" ? "bg-slate-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchEvidence()} disabled={loading}>
            <RefreshCcw size={14} />
          </Button>
        </div>
      </div>

      {evidence.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
          <Upload size={28} className="text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">{t("evidence.empty")}</p>
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-2">
          {evidence.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {categoryIcon(e.category)}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{e.fileName}</p>
                  <p className="text-xs text-gray-500">
                    {e.entityType} | {formatDate(e.createdAt)}
                    {e.fileSize ? ` | ${formatFileSize(e.fileSize)}` : ""}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={categoryBadgeClass(e.category)}>
                {t(`evidence.category.${e.category}`)}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {evidence.map((e) => (
            <Card key={e.id} className="hover:border-blue-300 transition-colors cursor-pointer">
              <CardContent className="py-4 text-center">
                <div className="flex justify-center mb-2">
                  {categoryIcon(e.category)}
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{e.fileName}</p>
                <Badge variant="outline" className={`mt-2 ${categoryBadgeClass(e.category)}`}>
                  {t(`evidence.category.${e.category}`)}
                </Badge>
                <p className="text-[10px] text-gray-400 mt-1">{formatDate(e.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
