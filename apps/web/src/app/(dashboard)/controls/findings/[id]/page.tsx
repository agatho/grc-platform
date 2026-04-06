"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  User,
  Calendar,
  Activity,
  FileCheck,
  Upload,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { FindingSeverityBadge } from "@/components/control/finding-severity-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Finding, Evidence, FindingStatus } from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FindingDetail extends Finding {
  ownerName?: string;
  controlTitle?: string;
}

interface StatusHistoryEntry {
  id: string;
  fromStatus: FindingStatus;
  toStatus: FindingStatus;
  changedBy: string;
  changedAt: string;
  comment?: string;
}

interface AuditLogEntry {
  id: string;
  userName: string | null;
  action: string;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr?: string): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString();
}

function statusBadgeClass(status: FindingStatus): string {
  const map: Record<FindingStatus, string> = {
    identified: "bg-gray-100 text-gray-700 border-gray-200",
    in_remediation: "bg-blue-100 text-blue-800 border-blue-200",
    remediated: "bg-cyan-100 text-cyan-800 border-cyan-200",
    verified: "bg-emerald-100 text-emerald-800 border-emerald-200",
    accepted: "bg-yellow-100 text-yellow-800 border-yellow-200",
    closed: "bg-slate-200 text-slate-600 border-slate-300",
  };
  return map[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function FindingDetailPage() {
  return (
    <ModuleGate moduleKey="ics">
      <FindingDetailInner />
    </ModuleGate>
  );
}

function FindingDetailInner() {
  const t = useTranslations("findings");
  const params = useParams();
  const router = useRouter();
  const findingId = params.id as string;

  const [finding, setFinding] = useState<FindingDetail | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [findingRes, historyRes, evidenceRes, logRes] = await Promise.all([
        fetch(`/api/v1/findings/${findingId}`),
        fetch(`/api/v1/findings/${findingId}/status-history`),
        fetch(`/api/v1/evidence?entityType=finding&entityId=${findingId}`),
        fetch(`/api/v1/audit-log?entityType=finding&entityId=${findingId}&limit=50`),
      ]);
      if (findingRes.ok) {
        const json = await findingRes.json();
        setFinding(json.data ?? null);
      }
      if (historyRes.ok) {
        const json = await historyRes.json();
        setStatusHistory(json.data ?? []);
      }
      if (evidenceRes.ok) {
        const json = await evidenceRes.json();
        setEvidence(json.data ?? []);
      }
      if (logRes.ok) {
        const json = await logRes.json();
        setAuditLog(json.data ?? []);
      }
    } catch {
      // handled by null checks
    } finally {
      setLoading(false);
    }
  }, [findingId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/controls/findings")}>
          <ArrowLeft size={16} />
          {t("backToList")}
        </Button>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle size={32} className="text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">{t("notFound")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/controls/findings")}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{finding.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <FindingSeverityBadge severity={finding.severity} />
            <Badge variant="outline" className={statusBadgeClass(finding.status)}>
              {t(`status.${finding.status}`)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="statusHistory">{t("tabs.statusHistory")}</TabsTrigger>
          <TabsTrigger value="verification">{t("tabs.verification")}</TabsTrigger>
          <TabsTrigger value="evidence">{t("tabs.evidence")}</TabsTrigger>
          <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">{t("tabs.overview")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {finding.description && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">{t("form.description")}</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{finding.description}</p>
                  </div>
                )}
                {finding.remediationPlan && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">{t("form.remediationPlan")}</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{finding.remediationPlan}</p>
                  </div>
                )}
                {finding.controlTitle && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">{t("form.linkedControl")}</p>
                    <p className="text-sm text-blue-600">{finding.controlTitle}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("metadata")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-gray-400" />
                  <span className="text-gray-500">{t("form.owner")}:</span>
                  <span className="font-medium">{finding.ownerName ?? "\u2014"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-gray-400" />
                  <span className="text-gray-500">{t("form.source")}:</span>
                  <span className="font-medium">{t(`source.${finding.source}`)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <span className="text-gray-500">{t("form.dueDate")}:</span>
                  <span className="font-medium">{formatDate(finding.remediationDueDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-gray-400" />
                  <span className="text-gray-500">{t("form.createdAt")}:</span>
                  <span className="font-medium">{formatDate(finding.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Status History */}
        <TabsContent value="statusHistory" className="mt-4">
          {statusHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <Activity size={28} className="text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">{t("statusHistory.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {statusHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <Activity size={14} className="text-gray-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{entry.changedBy}</span>{" "}
                      <Badge variant="outline" className={statusBadgeClass(entry.fromStatus)}>
                        {t(`status.${entry.fromStatus}`)}
                      </Badge>
                      {" -> "}
                      <Badge variant="outline" className={statusBadgeClass(entry.toStatus)}>
                        {t(`status.${entry.toStatus}`)}
                      </Badge>
                    </p>
                    {entry.comment && (
                      <p className="text-xs text-gray-500 mt-1">{entry.comment}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(entry.changedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Verification */}
        <TabsContent value="verification" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("tabs.verification")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <FileCheck size={14} className="text-gray-400" />
                <span className="text-gray-500">{t("verification.remediatedAt")}:</span>
                <span className="font-medium">{formatDate(finding.remediatedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileCheck size={14} className="text-gray-400" />
                <span className="text-gray-500">{t("verification.verifiedAt")}:</span>
                <span className="font-medium">{formatDate(finding.verifiedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <User size={14} className="text-gray-400" />
                <span className="text-gray-500">{t("verification.verifiedBy")}:</span>
                <span className="font-medium">{finding.verifiedBy ?? "\u2014"}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evidence */}
        <TabsContent value="evidence" className="mt-4">
          {evidence.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <Upload size={28} className="text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">{t("evidence.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {evidence.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Upload size={14} className="text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{e.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {e.category} | {e.fileSize ? `${(e.fileSize / 1024).toFixed(1)} KB` : ""} | {formatDate(e.createdAt)}
                      </p>
                    </div>
                  </div>
                  {e.description && (
                    <span className="text-xs text-gray-500">{e.description}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="mt-4">
          {auditLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <Activity size={28} className="text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">{t("history.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <Activity size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{entry.userName ?? "System"}</span>
                      {" "}
                      <span className="text-gray-500">{entry.action}</span>
                    </p>
                    {entry.changes && (
                      <div className="mt-1 text-xs text-gray-500">
                        {Object.entries(entry.changes).map(([key, val]) => (
                          <p key={key}>
                            <span className="font-mono">{key}</span>:{" "}
                            <span className="line-through text-red-400">{String(val.old ?? "\u2014")}</span>
                            {" -> "}
                            <span className="text-emerald-600">{String(val.new ?? "\u2014")}</span>
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">{formatDate(entry.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
