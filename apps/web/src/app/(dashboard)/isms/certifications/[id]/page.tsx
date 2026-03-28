"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  RefreshCcw,
  Camera,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileDown,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GapItem {
  id: string;
  catalogCode: string;
  catalogTitleDe: string;
  catalogTitleEn: string;
  implementation: string;
  applicability: string;
  controlId: string | null;
}

interface Snapshot {
  id: string;
  framework: string;
  score: number;
  gapCount: number;
  passedCount: number;
  totalChecks: number;
  createdAt: string;
}

export default function CertificationDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <CertDetailInner />
    </ModuleGate>
  );
}

function CertDetailInner() {
  const t = useTranslations("certifications");
  const params = useParams();
  const router = useRouter();
  const frameworkId = params.id as string;

  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [gapStats, setGapStats] = useState<Record<string, number>>({});
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [gapRes, snapRes] = await Promise.all([
        fetch("/api/v1/isms/certification/gaps?limit=50"),
        fetch(`/api/v1/isms/certification/snapshots?framework=${frameworkId}`),
      ]);

      if (gapRes.ok) {
        const json = await gapRes.json();
        setGaps(json.data);
        setGapStats(json.stats);
      }
      if (snapRes.ok) {
        const json = await snapRes.json();
        setSnapshots(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [frameworkId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCreateSnapshot = useCallback(async () => {
    setSnapshotLoading(true);
    try {
      const res = await fetch("/api/v1/isms/certification/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ framework: frameworkId }),
      });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setSnapshotLoading(false);
    }
  }, [frameworkId, fetchData]);

  if (loading && gaps.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const frameworkNames: Record<string, string> = {
    iso27001: "ISO 27001",
    soc2: "SOC 2",
    tisax: "TISAX",
    c5: "BSI C5",
    iso22301: "ISO 22301",
    iso27701: "ISO 27701",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/isms/certifications">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={14} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {frameworkNames[frameworkId] ?? frameworkId}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t("gapAnalysis")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateSnapshot}
            disabled={snapshotLoading}
          >
            <Camera size={14} className="mr-1" />
            {snapshotLoading ? t("creating") : t("createSnapshot")}
          </Button>
          <Link href={`/isms/certifications/${frameworkId}/audit-prep`}>
            <Button variant="outline" size="sm">
              <FileDown size={14} className="mr-1" />
              {t("auditPrep")}
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Gap Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-medium text-red-700">{t("notImplemented")}</p>
          <p className="text-2xl font-bold text-red-800">{gapStats.notImplemented ?? 0}</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-xs font-medium text-yellow-700">{t("planned")}</p>
          <p className="text-2xl font-bold text-yellow-800">{gapStats.planned ?? 0}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium text-blue-700">{t("partiallyImplemented")}</p>
          <p className="text-2xl font-bold text-blue-800">{gapStats.partiallyImplemented ?? 0}</p>
        </div>
      </div>

      {/* Gap Analysis Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t("openGapsTitle")}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {gapStats.total ?? 0} {t("controlsNeedAttention")}
          </p>
        </div>
        {gaps.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">{t("noGaps")}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {gaps.map((gap) => (
              <div key={gap.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {gap.controlId ? (
                    <CheckCircle2 className="h-4 w-4 text-yellow-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      <span className="font-mono text-gray-400 mr-2">{gap.catalogCode}</span>
                      {gap.catalogTitleDe || gap.catalogTitleEn}
                    </p>
                  </div>
                </div>
                <ImplementationBadge implementation={gap.implementation} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Snapshot History */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{t("snapshotHistory")}</h2>
        </div>
        {snapshots.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">{t("noSnapshots")}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {snapshots.map((snap) => (
              <div key={snap.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(snap.createdAt).toLocaleDateString("de-DE")} -{" "}
                    {new Date(snap.createdAt).toLocaleTimeString("de-DE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {snap.passedCount}/{snap.totalChecks} {t("checksPassed")} | {snap.gapCount} {t("gaps")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        snap.score >= 75 ? "bg-green-500" : snap.score >= 50 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${snap.score}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-700 w-12 text-right">{snap.score}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ImplementationBadge({ implementation }: { implementation: string }) {
  const config: Record<string, { color: string; label: string }> = {
    not_implemented: { color: "bg-red-100 text-red-700 border-red-200", label: "Nicht implementiert" },
    planned: { color: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Geplant" },
    partially_implemented: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Teilweise" },
    implemented: { color: "bg-green-100 text-green-700 border-green-200", label: "Implementiert" },
  };
  const c = config[implementation] ?? { color: "", label: implementation };
  return (
    <Badge variant="outline" className={`text-[10px] ${c.color}`}>
      {c.label}
    </Badge>
  );
}
