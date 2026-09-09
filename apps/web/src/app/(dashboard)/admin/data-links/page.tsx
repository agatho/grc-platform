"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useTranslations } from "next-intl";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Fest verdrahtetes Deutsch, hier
 * zusaetzlich mit HTML-Entitaeten geschrieben (`Verkn&uuml;pfung`) — eine
 * Schreibweise, die keine Uebersetzungsschleife und kein Werkzeug findet.
 */

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

const linkTypeColors: Record<string, string> = {
  reference: "bg-blue-100 text-blue-800",
  aggregate: "bg-purple-100 text-purple-800",
  mirror: "bg-indigo-100 text-indigo-800",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DataLinksPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { formatDate } = useDateFormat();
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert
  // wie vorher leere Liste und keine Kennzahlen; ein Netzfehler wird nicht
  // mehr verschluckt, sondern landet im Fehlerzustand der Abfrage (die Seite
  // zeigt dann ueber die Vorgabewerte dieselbe Leeransicht).
  const {
    data,
    isPending: loading,
    isFetching,
    refetch,
  } = useQuery<{ links: DataLink[]; stats: DataLinkStats | null }>({
    queryKey: ["data-links", "list"],
    queryFn: async () => {
      const res = await fetch("/api/v1/data-links");
      if (!res.ok) return { links: [], stats: null };
      const json = await res.json();
      return {
        links: (json.data ?? []) as DataLink[],
        stats: (json.stats ?? null) as DataLinkStats | null,
      };
    },
  });
  const links = data?.links ?? [];
  const stats = data?.stats ?? null;

  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

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
            {t("dataLinks.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("dataLinks.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isFetching}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            {tCommon("actions.refresh")}
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("dataLinks.create")}
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
                <p className="text-xs text-gray-500">
                  {t("dataLinks.kpi.activeLinks")}
                </p>
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
                <p className="text-xs text-gray-500">
                  {t("dataLinks.bidirectional")}
                </p>
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
                <p className="text-xs text-gray-500">
                  {t("dataLinks.kpi.modulesLinked")}
                </p>
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
                  {stats?.lastSync ? formatDate(stats.lastSync) : "\u2014"}
                </p>
                <p className="text-xs text-gray-500">
                  {t("dataLinks.kpi.lastSync")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Links Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("dataLinks.tableTitle", { count: links.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-400">
              <Unlink className="mb-3 h-10 w-10" />
              <p className="font-medium text-gray-500">
                {t("dataLinks.empty")}
              </p>
              <p className="mt-1 text-gray-400">{t("dataLinks.emptyHint")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      {t("dataLinks.column.source")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      &nbsp;
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      {t("dataLinks.column.target")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      {t("dataLinks.column.type")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      {t("dataLinks.column.direction")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      {t("reminders.column.status")}
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
                          {t(`dataLinks.linkType.${link.linkType}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {link.bidirectional ? (
                          <Badge className="bg-indigo-100 text-indigo-800 text-xs">
                            <ArrowRightLeft className="mr-1 h-3 w-3" />
                            {t("dataLinks.bidirectional")}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {t("dataLinks.unidirectional")}
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
                          {t(`dataLinks.status.${link.status}`)}
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
