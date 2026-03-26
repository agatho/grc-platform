"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  FileText,
  User,
  Calendar,
  Activity,
  GitBranch,
  Link2,
  CheckCircle2,
  Send,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Document,
  DocumentVersion,
  DocumentEntityLink,
  Acknowledgment,
  DocumentStatus,
} from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentDetail extends Document {
  ownerName?: string;
  reviewerName?: string;
}

interface AckUser extends Acknowledgment {
  userName?: string;
  userEmail?: string;
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

function statusBadgeClass(status: DocumentStatus): string {
  const map: Record<DocumentStatus, string> = {
    draft: "bg-gray-100 text-gray-700 border-gray-200",
    in_review: "bg-blue-100 text-blue-800 border-blue-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    published: "bg-green-100 text-green-800 border-green-200",
    archived: "bg-slate-200 text-slate-600 border-slate-300",
    expired: "bg-red-100 text-red-800 border-red-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DocumentDetailPage() {
  return (
    <ModuleGate moduleKey="dms">
      <DocumentDetailInner />
    </ModuleGate>
  );
}

function DocumentDetailInner() {
  const t = useTranslations("documents");
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [entityLinks, setEntityLinks] = useState<DocumentEntityLink[]>([]);
  const [acknowledgments, setAcknowledgments] = useState<AckUser[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [docRes, versionsRes, linksRes, acksRes, logRes] = await Promise.all([
        fetch(`/api/v1/documents/${docId}`),
        fetch(`/api/v1/documents/${docId}/versions`),
        fetch(`/api/v1/documents/${docId}/entity-links`),
        fetch(`/api/v1/documents/${docId}/acknowledgments`),
        fetch(`/api/v1/audit-log?entityType=document&entityId=${docId}&limit=50`),
      ]);
      if (docRes.ok) {
        const json = await docRes.json();
        setDoc(json.data ?? null);
      }
      if (versionsRes.ok) {
        const json = await versionsRes.json();
        setVersions(json.data ?? []);
      }
      if (linksRes.ok) {
        const json = await linksRes.json();
        setEntityLinks(json.data ?? []);
      }
      if (acksRes.ok) {
        const json = await acksRes.json();
        setAcknowledgments(json.data ?? []);
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
  }, [docId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSendReminder = async () => {
    try {
      const res = await fetch(`/api/v1/documents/${docId}/send-reminder`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("acknowledgments.reminderSent"));
    } catch {
      toast.error(t("acknowledgments.reminderError"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/documents")}>
          <ArrowLeft size={16} />
          {t("backToList")}
        </Button>
        <div className="flex flex-col items-center justify-center py-12">
          <FileText size={32} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">{t("notFound")}</p>
        </div>
      </div>
    );
  }

  const ackPct = acknowledgments.length > 0
    ? Math.round((acknowledgments.filter((a) => a.acknowledgedAt).length / acknowledgments.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/documents")}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{doc.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={statusBadgeClass(doc.status)}>
              {t(`status.${doc.status}`)}
            </Badge>
            <span className="text-xs font-mono text-gray-500">v{doc.currentVersion}</span>
            {doc.tags.length > 0 && doc.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">{t("tabs.content")}</TabsTrigger>
          <TabsTrigger value="versions">{t("tabs.versions")}</TabsTrigger>
          <TabsTrigger value="entityLinks">{t("tabs.entityLinks")}</TabsTrigger>
          <TabsTrigger value="acknowledgments">
            {t("tabs.acknowledgments")}
            {doc.requiresAcknowledgment && (
              <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                {ackPct}%
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
        </TabsList>

        {/* Content */}
        <TabsContent value="content" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Card className="lg:col-span-3">
              <CardContent className="py-6">
                {doc.content ? (
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                    {doc.content}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">{t("content.empty")}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("metadata")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-gray-400" />
                  <span className="text-gray-500">{t("form.owner")}:</span>
                  <span className="font-medium">{doc.ownerName ?? "\u2014"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User size={14} className="text-gray-400" />
                  <span className="text-gray-500">{t("form.reviewer")}:</span>
                  <span className="font-medium">{doc.reviewerName ?? "\u2014"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <span className="text-gray-500">{t("form.publishedAt")}:</span>
                  <span className="font-medium">{formatDate(doc.publishedAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <span className="text-gray-500">{t("form.expiresAt")}:</span>
                  <span className="font-medium">{formatDate(doc.expiresAt)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Versions */}
        <TabsContent value="versions" className="mt-4">
          {versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <GitBranch size={28} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">{t("versions.empty")}</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {versions.map((v) => (
                  <div key={v.id} className="relative pl-10">
                    <div
                      className={`absolute left-2.5 top-3 h-3 w-3 rounded-full border-2 ${
                        v.isCurrent
                          ? "bg-blue-500 border-blue-500"
                          : "bg-white border-gray-300"
                      }`}
                    />
                    <Card className={v.isCurrent ? "border-blue-300" : ""}>
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium text-gray-900">
                              v{v.versionNumber}
                            </span>
                            {v.isCurrent && (
                              <Badge className="bg-blue-600 text-white text-[10px]">
                                {t("versions.current")}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">{formatDate(v.createdAt)}</span>
                        </div>
                        {v.changeSummary && (
                          <p className="text-xs text-gray-600 mt-1">{v.changeSummary}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Entity Links */}
        <TabsContent value="entityLinks" className="mt-4">
          {entityLinks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <Link2 size={28} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">{t("entityLinks.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entityLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Link2 size={14} className="text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{link.entityType}</p>
                      {link.linkDescription && (
                        <p className="text-xs text-gray-500">{link.linkDescription}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">{link.entityId.slice(0, 8)}...</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Acknowledgments */}
        <TabsContent value="acknowledgments" className="mt-4 space-y-4">
          {doc.requiresAcknowledgment && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${ackPct >= 80 ? "bg-emerald-500" : ackPct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${ackPct}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700">{ackPct}% {t("acknowledgments.complete")}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSendReminder}>
                <Send size={14} />
                {t("acknowledgments.sendReminder")}
              </Button>
            </div>
          )}

          {acknowledgments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <CheckCircle2 size={28} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">{t("acknowledgments.empty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase">
                    <th className="pb-2 pr-4">{t("acknowledgments.user")}</th>
                    <th className="pb-2 pr-4">{t("acknowledgments.version")}</th>
                    <th className="pb-2 pr-4">{t("acknowledgments.date")}</th>
                    <th className="pb-2">{t("acknowledgments.statusLabel")}</th>
                  </tr>
                </thead>
                <tbody>
                  {acknowledgments.map((ack) => (
                    <tr key={ack.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-4 text-gray-900">
                        {ack.userName ?? ack.userEmail ?? ack.userId.slice(0, 8)}
                      </td>
                      <td className="py-2 pr-4 font-mono text-gray-600">v{ack.versionAcknowledged}</td>
                      <td className="py-2 pr-4 text-gray-600">{formatDate(ack.acknowledgedAt)}</td>
                      <td className="py-2">
                        {ack.acknowledgedAt ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            {t("acknowledgments.acknowledged")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                            {t("acknowledgments.pending")}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="mt-4">
          {auditLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <Activity size={28} className="text-gray-300 mb-3" />
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
