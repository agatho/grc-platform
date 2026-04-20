"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCcw,
  Link2,
  ArrowRightLeft,
  Layers,
  Clock,
  Unlink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataLinkStats {
  activeLinks: number;
  bidirectional: number;
  modulesLinked: number;
  lastSync: string | null;
}

interface DataLink {
  id: string;
  sourceType: string;
  sourceField: string;
  targetType: string;
  targetField: string;
  linkType: "reference" | "aggregate" | "mirror";
  bidirectional: boolean;
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

const linkTypeColors: Record<string, string> = {
  reference: "bg-blue-100 text-blue-800",
  aggregate: "bg-purple-100 text-purple-800",
  mirror: "bg-indigo-100 text-indigo-800",
};

const linkTypeLabels: Record<string, string> = {
  reference: "Referenz",
  aggregate: "Aggregation",
  mirror: "Spiegelung",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DataLinksPage() {
  const [stats, setStats] = useState<DataLinkStats | null>(null);
  const [links, setLinks] = useState<DataLink[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/data-links");
      if (res.ok) {
        const json = await res.json();
        setLinks(json.data ?? []);
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
            Live-Datenverkn&uuml;pfungen
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Automatische Aktualisierung verkn&uuml;pfter Datenpunkte &uuml;ber
            Module hinweg
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
            Verkn&uuml;pfung erstellen
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Link2 className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.activeLinks ?? 0}</p>
                <p className="text-xs text-gray-500">Aktive Links</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {stats?.bidirectional ?? 0}
                </p>
                <p className="text-xs text-gray-500">Bidirektional</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Layers className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {stats?.modulesLinked ?? 0}
                </p>
                <p className="text-xs text-gray-500">Module verkn&uuml;pft</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">
                  {stats?.lastSync
                    ? new Date(stats.lastSync).toLocaleDateString("de-DE")
                    : "\u2014"}
                </p>
                <p className="text-xs text-gray-500">Letzte Synchronisation</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Links Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Datenverkn&uuml;pfungen ({links.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-400">
              <Unlink className="mb-3 h-10 w-10" />
              <p className="font-medium text-gray-500">
                Keine Verkn&uuml;pfungen vorhanden
              </p>
              <p className="mt-1 text-gray-400">
                Erstellen Sie automatische Datenverkn&uuml;pfungen zwischen
                Modulen.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Quelle
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      &nbsp;
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Ziel
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Typ
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Richtung
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {links.map((link) => (
                    <tr key={link.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {link.sourceType}
                        </div>
                        <code className="text-xs font-mono text-gray-500">
                          {link.sourceField}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400">
                        &rarr;
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {link.targetType}
                        </div>
                        <code className="text-xs font-mono text-gray-500">
                          {link.targetField}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`text-xs ${linkTypeColors[link.linkType] ?? ""}`}
                        >
                          {linkTypeLabels[link.linkType] ?? link.linkType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {link.bidirectional ? (
                          <Badge className="bg-indigo-100 text-indigo-800 text-xs">
                            <ArrowRightLeft className="mr-1 h-3 w-3" />
                            Bidirektional
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">
                            Unidirektional
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          className={
                            statusColors[link.status] ??
                            "bg-gray-100 text-gray-800"
                          }
                        >
                          {statusLabels[link.status] ?? link.status}
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
