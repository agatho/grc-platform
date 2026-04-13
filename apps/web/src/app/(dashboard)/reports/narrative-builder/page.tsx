"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  FileText,
  Languages,
  Hash,
  BookOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NarrativeTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  placeholderCount: number;
  version: number;
  status: "draft" | "active" | "archived";
  contentPreview: string;
  placeholderTokens: string[];
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-800",
};

const statusLabels: Record<string, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  archived: "Archiviert",
};

const categoryColors: Record<string, string> = {
  executive_summary: "bg-blue-100 text-blue-800",
  risk_section: "bg-red-100 text-red-800",
  control_section: "bg-indigo-100 text-indigo-800",
  compliance_section: "bg-purple-100 text-purple-800",
  audit_section: "bg-orange-100 text-orange-800",
  general: "bg-gray-100 text-gray-800",
};

const categoryLabels: Record<string, string> = {
  executive_summary: "Executive Summary",
  risk_section: "Risiko",
  control_section: "Kontrollen",
  compliance_section: "Compliance",
  audit_section: "Audit",
  general: "Allgemein",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NarrativeBuilderPage() {
  const [templates, setTemplates] = useState<NarrativeTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/reports/narrative-templates");
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.data ?? []);
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
            Narrative Builder
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Textbausteine mit automatischen Datenverkn&uuml;pfungen f&uuml;r Berichte
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Template erstellen
          </Button>
        </div>
      </div>

      {/* Template Cards */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-sm text-gray-400">
            <BookOpen className="mb-3 h-10 w-10" />
            <p className="font-medium text-gray-500">Keine Templates vorhanden</p>
            <p className="mt-1 text-gray-400">
              Erstellen Sie Ihr erstes Narrative-Template f&uuml;r automatisierte Berichte.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-semibold">
                    {tpl.name}
                  </CardTitle>
                  <Badge className={statusColors[tpl.status] ?? "bg-gray-100 text-gray-800"}>
                    {statusLabels[tpl.status] ?? tpl.status}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${categoryColors[tpl.category] ?? ""}`}
                    >
                      {categoryLabels[tpl.category] ?? tpl.category}
                    </Badge>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Languages className="h-3 w-3" />
                    {tpl.language === "de" ? "Deutsch" : "English"}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    v{tpl.version}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Content Preview */}
                <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                  {tpl.contentPreview}
                </p>

                {/* Placeholder Tokens */}
                <div className="flex flex-wrap gap-1.5">
                  {tpl.placeholderTokens.slice(0, 5).map((token) => (
                    <span
                      key={token}
                      className="inline-flex items-center rounded bg-amber-50 border border-amber-200 px-2 py-0.5 font-mono text-xs text-amber-700"
                    >
                      {`{{${token}}}`}
                    </span>
                  ))}
                  {tpl.placeholderTokens.length > 5 && (
                    <span className="text-xs text-gray-400">
                      +{tpl.placeholderTokens.length - 5} weitere
                    </span>
                  )}
                </div>

                {/* Meta Row */}
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {tpl.placeholderCount} Platzhalter
                  </span>
                  <span>
                    {new Date(tpl.updatedAt).toLocaleDateString("de-DE")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
