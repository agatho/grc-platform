"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Minus,
  RefreshCw,
  GitCompare,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@grc/ui";
import type { VersionComparison, ElementDiffDetail } from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProcessVersion {
  versionNumber: number;
  changeSummary?: string;
  createdAt: string;
  createdByName?: string;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function VersionComparePage() {
  return (
    <ModuleGate moduleKey="bpm">
      <CompareContent />
    </ModuleGate>
  );
}

function CompareContent() {
  const t = useTranslations("processGovernance");
  const tProcess = useTranslations("process");
  const params = useParams();
  const searchParams = useSearchParams();
  const processId = params.id as string;

  const initialFrom = searchParams.get("from");
  const initialTo = searchParams.get("to");

  const [versions, setVersions] = useState<ProcessVersion[]>([]);
  const [versionFrom, setVersionFrom] = useState(initialFrom ?? "");
  const [versionTo, setVersionTo] = useState(initialTo ?? "");
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(true);

  // Fetch available versions
  useEffect(() => {
    setVersionsLoading(true);
    fetch(`/api/v1/processes/${processId}`)
      .then((r) => (r.ok ? r.json() : { data: {} }))
      .then((json) => {
        const versionsList = (json.data?.versions ?? []) as ProcessVersion[];
        setVersions(versionsList.sort((a, b) => b.versionNumber - a.versionNumber));
        if (!versionFrom && versionsList.length >= 2) {
          const sorted = [...versionsList].sort((a, b) => a.versionNumber - b.versionNumber);
          setVersionFrom(String(sorted[sorted.length - 2].versionNumber));
          setVersionTo(String(sorted[sorted.length - 1].versionNumber));
        }
      })
      .catch(() => setVersions([]))
      .finally(() => setVersionsLoading(false));
  }, [processId]);

  // Fetch comparison
  const fetchComparison = useCallback(async () => {
    if (!versionFrom || !versionTo || versionFrom === versionTo) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/processes/${processId}/compare?from=${versionFrom}&to=${versionTo}`,
      );
      if (!res.ok) throw new Error("Failed to load comparison");
      const json = await res.json();
      setComparison(json.data ?? null);
    } catch {
      setComparison(null);
    } finally {
      setLoading(false);
    }
  }, [processId, versionFrom, versionTo]);

  useEffect(() => {
    if (versionFrom && versionTo) {
      void fetchComparison();
    }
  }, [fetchComparison, versionFrom, versionTo]);

  const stats = comparison?.diff?.stats ?? { added: 0, removed: 0, modified: 0 };

  // Version details lookup
  const fromVersion = versions.find((v) => v.versionNumber === Number(versionFrom));
  const toVersion = versions.find((v) => v.versionNumber === Number(versionTo));

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href={`/processes/${processId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        {tProcess("detail.backToList")}
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <GitCompare className="h-6 w-6 text-indigo-500" />
        <h1 className="text-2xl font-bold text-gray-900">
          {t("compare.title")}
        </h1>
      </div>

      {/* Version selectors */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 uppercase">
            From
          </label>
          <Select value={versionFrom} onValueChange={setVersionFrom}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("compare.version")} />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.versionNumber} value={String(v.versionNumber)}>
                  v{v.versionNumber} &mdash;{" "}
                  {new Date(v.createdAt).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="text-gray-400 mt-5">vs</span>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 uppercase">
            To
          </label>
          <Select value={versionTo} onValueChange={setVersionTo}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("compare.version")} />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.versionNumber} value={String(v.versionNumber)}>
                  v{v.versionNumber} &mdash;{" "}
                  {new Date(v.createdAt).toLocaleDateString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading || versionsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : comparison ? (
        <>
          {/* Diff summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 text-center">
                <Plus className="mx-auto h-5 w-5 text-green-600 mb-1" />
                <p className="text-2xl font-bold text-green-700">{stats.added}</p>
                <p className="text-xs text-green-600">{t("compare.added")}</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 text-center">
                <Minus className="mx-auto h-5 w-5 text-red-600 mb-1" />
                <p className="text-2xl font-bold text-red-700">{stats.removed}</p>
                <p className="text-xs text-red-600">{t("compare.removed")}</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4 text-center">
                <RefreshCw className="mx-auto h-5 w-5 text-yellow-600 mb-1" />
                <p className="text-2xl font-bold text-yellow-700">{stats.modified}</p>
                <p className="text-xs text-yellow-600">{t("compare.modified")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Version detail panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VersionPanel
              label="From"
              version={fromVersion}
              t={t}
            />
            <VersionPanel
              label="To"
              version={toVersion}
              t={t}
            />
          </div>

          {/* Element details table */}
          {comparison.details && comparison.details.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("compare.attributeDiff")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="pb-2 text-left font-medium text-gray-500">Element</th>
                        <th className="pb-2 text-left font-medium text-gray-500">Attribute</th>
                        <th className="pb-2 text-left font-medium text-gray-500">Old</th>
                        <th className="pb-2 text-left font-medium text-gray-500">New</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.details.map((detail) =>
                        detail.changes.map((change, idx) => (
                          <tr key={`${detail.elementId}-${change.attribute}`} className="border-b border-gray-50">
                            {idx === 0 && (
                              <td
                                className="py-2 text-gray-900 font-medium align-top"
                                rowSpan={detail.changes.length}
                              >
                                <div>
                                  {detail.elementName ?? detail.elementId}
                                  <span className="block text-[10px] text-gray-400">
                                    {detail.elementType}
                                  </span>
                                </div>
                              </td>
                            )}
                            <td className="py-2 text-gray-600">{change.attribute}</td>
                            <td className="py-2">
                              <span className="text-red-600 bg-red-50 px-1 rounded text-xs">
                                {change.oldValue ?? "-"}
                              </span>
                            </td>
                            <td className="py-2">
                              <span className="text-green-600 bg-green-50 px-1 rounded text-xs">
                                {change.newValue ?? "-"}
                              </span>
                            </td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <GitCompare className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            Select two different versions to compare
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Version Panel
// ---------------------------------------------------------------------------

function VersionPanel({
  label,
  version,
  t,
}: {
  label: string;
  version?: ProcessVersion;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!version) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{label}</Badge>
          {t("compare.version")} {version.versionNumber}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Date</span>
          <span className="font-medium text-gray-900">
            {new Date(version.createdAt).toLocaleDateString()}
          </span>
        </div>
        {version.createdByName && (
          <div className="flex justify-between text-gray-600">
            <span>Creator</span>
            <span className="font-medium text-gray-900">{version.createdByName}</span>
          </div>
        )}
        {version.changeSummary && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">Change Summary</p>
            <p className="text-sm text-gray-700 mt-1">{version.changeSummary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
