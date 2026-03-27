"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Send,
  FileText,
  Shield,
  User,
  Calendar,
  Hash,
  Globe,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WbCaseDetail } from "@grc/shared";

export default function WbCaseDetailPage() {
  return (
    <ModuleGate moduleKey="whistleblowing">
      <CaseDetailInner />
    </ModuleGate>
  );
}

const STATUS_STEPS = ["received", "acknowledged", "investigating", "resolved"];

function CaseDetailInner() {
  const t = useTranslations("whistleblowing");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<WbCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Resolution form
  const [resolution, setResolution] = useState("");
  const [resolutionCategory, setResolutionCategory] = useState("");
  const [resolutionMessage, setResolutionMessage] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);

  const fetchCase = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/whistleblowing/cases/${id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/v1/whistleblowing/cases/${id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageText }),
      });
      if (res.ok) {
        setMessageText("");
        fetchCase();
      }
    } finally {
      setSending(false);
    }
  };

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      const res = await fetch(`/api/v1/whistleblowing/cases/${id}/acknowledge`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) fetchCase();
    } finally {
      setAcknowledging(false);
    }
  };

  const handleResolve = async () => {
    if (resolution.length < 10 || !resolutionCategory) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/v1/whistleblowing/cases/${id}/resolve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution,
          resolutionCategory,
          message: resolutionMessage || undefined,
        }),
      });
      if (res.ok) {
        setShowResolveForm(false);
        fetchCase();
      }
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">{t("caseNotFound")}</p>
      </div>
    );
  }

  const { case: caseRow, report, messages, evidence } = data;
  const currentStepIdx = STATUS_STEPS.indexOf(caseRow.status);

  const daysUntilAck = Math.ceil(
    (new Date(caseRow.acknowledgeDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const daysUntilResponse = Math.ceil(
    (new Date(caseRow.responseDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/whistleblowing/cases")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("backToCases")}
        </Button>
        <h1 className="text-xl font-semibold text-gray-900">
          {caseRow.caseNumber}
        </h1>
        <Badge className="text-xs">{t(`status.${caseRow.status}`)}</Badge>
        <Badge className="text-xs">{t(`priority.${caseRow.priority}`)}</Badge>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
        {/* Left column: content + messages + evidence */}
        <div className="space-y-6">
          {/* Report content */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge className="text-xs">{t(`cat.${report.category}`)}</Badge>
              <span className="text-sm text-gray-400">
                {new Date(report.submittedAt).toLocaleDateString("de-DE")}
              </span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {report.description}
            </p>
            {report.contactEmail && (
              <p className="text-sm text-gray-500 mt-4">
                {t("contactEmail")}: {report.contactEmail}
              </p>
            )}
          </div>

          {/* Messages */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-medium text-gray-700 mb-4">{t("messages")}</h2>

            {messages.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                {t("noMessages")}
              </p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg p-3 ${
                        msg.direction === "outbound"
                          ? "bg-blue-100 text-blue-900"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      <p className="text-xs font-medium mb-1">
                        {msg.authorType === "ombudsperson" ? t("ombudsperson") : t("whistleblower")}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(msg.createdAt).toLocaleString("de-DE")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Send message */}
            {caseRow.status !== "closed" && (
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={2}
                  maxLength={5000}
                  placeholder={t("messageToWhistleblower")}
                  className="flex-1 rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
                <Button type="submit" disabled={sending || !messageText.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            )}
          </div>

          {/* Evidence */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-medium text-gray-700 mb-4">{t("evidence")}</h2>
            {evidence.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">{t("noEvidence")}</p>
            ) : (
              <div className="space-y-2">
                {evidence.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">{ev.fileName}</p>
                        <p className="text-xs text-gray-400">
                          SHA-256: {ev.sha256Hash?.slice(0, 16)}...
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {(ev.fileSize / 1024).toFixed(0)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolution form */}
          {showResolveForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-sm font-medium text-gray-700 mb-4">{t("resolveCase")}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{t("resolutionCategory")}</label>
                  <select
                    value={resolutionCategory}
                    onChange={(e) => setResolutionCategory(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">{t("selectCategory")}</option>
                    <option value="substantiated">{t("res.substantiated")}</option>
                    <option value="unsubstantiated">{t("res.unsubstantiated")}</option>
                    <option value="inconclusive">{t("res.inconclusive")}</option>
                    <option value="referred">{t("res.referred")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{t("resolutionText")}</label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    rows={4}
                    minLength={10}
                    maxLength={10000}
                    className="w-full rounded-lg border border-gray-300 p-3 text-sm resize-y"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">{t("finalMessage")}</label>
                  <textarea
                    value={resolutionMessage}
                    onChange={(e) => setResolutionMessage(e.target.value)}
                    rows={2}
                    maxLength={5000}
                    placeholder={t("optionalFinalMessage")}
                    className="w-full rounded-lg border border-gray-300 p-3 text-sm resize-y"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleResolve}
                    disabled={resolving || resolution.length < 10 || !resolutionCategory}
                  >
                    {resolving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t("resolveCase")}
                  </Button>
                  <Button variant="outline" onClick={() => setShowResolveForm(false)}>
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column: workflow + deadlines + meta */}
        <div className="space-y-6">
          {/* Deadlines */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">{t("deadlines")}</h3>

            <div className="space-y-4">
              {/* 7-day deadline */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{t("sla7d")}</span>
                </div>
                {caseRow.acknowledgedAt ? (
                  <Badge className="bg-green-100 text-green-700 text-xs">{t("completed")}</Badge>
                ) : daysUntilAck > 3 ? (
                  <Badge className="bg-green-100 text-green-700 text-xs">{daysUntilAck}d</Badge>
                ) : daysUntilAck > 0 ? (
                  <Badge className="bg-yellow-100 text-yellow-700 text-xs">{daysUntilAck}d</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 text-xs">{t("overdue")}</Badge>
                )}
              </div>

              {/* Acknowledge button */}
              {caseRow.status === "received" && (
                <Button
                  className="w-full"
                  onClick={handleAcknowledge}
                  disabled={acknowledging}
                >
                  {acknowledging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  {t("acknowledge")}
                </Button>
              )}

              {/* 3-month deadline */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{t("sla3m")}</span>
                </div>
                {caseRow.resolvedAt ? (
                  <Badge className="bg-green-100 text-green-700 text-xs">{t("completed")}</Badge>
                ) : daysUntilResponse > 14 ? (
                  <Badge className="bg-green-100 text-green-700 text-xs">{daysUntilResponse}d</Badge>
                ) : daysUntilResponse > 0 ? (
                  <Badge className="bg-yellow-100 text-yellow-700 text-xs">{daysUntilResponse}d</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 text-xs">{t("overdue")}</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Status workflow */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">{t("workflow")}</h3>
            <div className="space-y-3">
              {STATUS_STEPS.map((step, idx) => {
                const isCompleted = idx < currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                  <div key={step} className="flex items-center gap-3">
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isCurrent
                            ? "bg-blue-500 text-white"
                            : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </div>
                    <span className={`text-sm ${isCurrent ? "font-medium text-gray-900" : "text-gray-500"}`}>
                      {t(`status.${step}`)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Resolve button */}
            {(caseRow.status === "investigating" || caseRow.status === "acknowledged") && !showResolveForm && (
              <Button className="w-full mt-4" variant="outline" onClick={() => setShowResolveForm(true)}>
                {t("resolveCase")}
              </Button>
            )}
          </div>

          {/* Resolution info */}
          {caseRow.resolution && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t("resolutionTitle")}</h3>
              <Badge className="text-xs mb-2">{t(`res.${caseRow.resolutionCategory}`)}</Badge>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{caseRow.resolution}</p>
              {caseRow.resolvedAt && (
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(caseRow.resolvedAt).toLocaleDateString("de-DE")}
                </p>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">{t("metadata")}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-500">
                <Hash className="h-4 w-4" />
                {caseRow.caseNumber}
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Calendar className="h-4 w-4" />
                {new Date(report.submittedAt).toLocaleDateString("de-DE")}
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Globe className="h-4 w-4" />
                {report.language?.toUpperCase()}
              </div>
              {report.ipHash && (
                <div className="flex items-center gap-2 text-gray-500">
                  <Shield className="h-4 w-4" />
                  IP: {report.ipHash.slice(0, 12)}...
                </div>
              )}
              {caseRow.assignedToName && (
                <div className="flex items-center gap-2 text-gray-500">
                  <User className="h-4 w-4" />
                  {caseRow.assignedToName}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
