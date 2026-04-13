"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  Code2,
  Tag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Placeholder {
  id: string;
  token: string;
  label: string;
  category: string;
  source: string;
  currentValue: string | null;
  status: "active" | "inactive" | "error";
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  error: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  active: "Aktiv",
  inactive: "Inaktiv",
  error: "Fehler",
};

const categoryLabels: Record<string, string> = {
  organization: "Organisation",
  risk: "Risiko",
  control: "Kontrollen",
  compliance: "Compliance",
  audit: "Audit",
  kpi: "KPI",
  date: "Datum",
  general: "Allgemein",
};

const CATEGORIES = [
  "organization",
  "risk",
  "control",
  "compliance",
  "audit",
  "kpi",
  "date",
  "general",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlaceholdersPage() {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set("category", categoryFilter);
      const res = await fetch(`/api/v1/reports/placeholders?${params}`);
      if (res.ok) {
        const json = await res.json();
        setPlaceholders(json.data ?? []);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && placeholders.length === 0) {
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
            Daten-Platzhalter
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Wiederverwendbare Datenpunkte f&uuml;r automatische Berichtsinhalte
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Platzhalter erstellen
          </Button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2">
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">Alle Kategorien</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {categoryLabels[cat] ?? cat}
            </option>
          ))}
        </select>
      </div>

      {/* Placeholders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {placeholders.length} Platzhalter
          </CardTitle>
        </CardHeader>
        <CardContent>
          {placeholders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-400">
              <Code2 className="mb-3 h-10 w-10" />
              <p className="font-medium text-gray-500">Keine Platzhalter vorhanden</p>
              <p className="mt-1 text-gray-400">
                Erstellen Sie wiederverwendbare Datenpunkte f&uuml;r Ihre Berichte.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Token
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Label
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Kategorie
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Quelle
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Wert
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {placeholders.map((ph) => (
                    <tr key={ph.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <code className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                          {`{{${ph.token}}}`}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {ph.label}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">
                          <Tag className="mr-1 h-3 w-3" />
                          {categoryLabels[ph.category] ?? ph.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {ph.source}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {ph.currentValue ? (
                          <span className="text-gray-900">{ph.currentValue}</span>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={statusColors[ph.status] ?? "bg-gray-100 text-gray-800"}>
                          {statusLabels[ph.status] ?? ph.status}
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
