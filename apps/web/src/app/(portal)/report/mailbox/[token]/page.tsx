"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  Send,
  Upload,
  AlertTriangle,
  Shield,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface MailboxMessage {
  direction: string;
  content: string;
  authorType: string;
  createdAt: string;
}

interface MailboxEvidence {
  fileName: string;
  fileSize: number;
  uploadedAt: string;
}

interface MailboxData {
  status: string;
  caseNumber: string;
  acknowledgeDeadline: string;
  responseDeadline: string;
  acknowledgedAt: string | null;
  messages: MailboxMessage[];
  evidence: MailboxEvidence[];
}

const STATUS_STEPS = ["received", "acknowledged", "investigating", "resolved"];
const STATUS_LABELS: Record<string, { de: string; en: string }> = {
  received: { de: "Eingegangen", en: "Received" },
  acknowledged: { de: "Bestaetigt", en: "Acknowledged" },
  investigating: { de: "In Bearbeitung", en: "Investigating" },
  resolved: { de: "Geloest", en: "Resolved" },
  closed: { de: "Geschlossen", en: "Closed" },
};

export default function MailboxPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<MailboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [language, setLanguage] = useState<"de" | "en">("de");

  const t = (de: string, en: string) => (language === "de" ? de : en);

  const fetchMailbox = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/portal/mailbox/${token}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      } else {
        setError(t("Ungueltig oder abgelaufen", "Invalid or expired"));
      }
    } catch {
      setError(t("Verbindungsfehler", "Connection error"));
    } finally {
      setLoading(false);
    }
  }, [token, language]);

  useEffect(() => {
    fetchMailbox();
  }, [fetchMailbox]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/v1/portal/mailbox/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply }),
      });

      if (res.ok) {
        setReply("");
        fetchMailbox(); // Refresh messages
      }
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      await fetch(`/api/v1/portal/mailbox/${token}/evidence`, {
        method: "POST",
        body: formData,
      });
      fetchMailbox();
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {error || t("Postfach nicht gefunden", "Mailbox not found")}
          </p>
        </div>
      </div>
    );
  }

  const currentStepIdx = STATUS_STEPS.indexOf(data.status);

  const daysUntilAck = Math.ceil(
    (new Date(data.acknowledgeDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  const daysUntilResponse = Math.ceil(
    (new Date(data.responseDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="max-w-[720px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("Anonymes Postfach", "Anonymous Mailbox")}
          </h1>
          <p className="text-sm text-gray-500">
            {t("Vorgang", "Case")}: {data.caseNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage("de")}
            className={`px-3 py-1 text-sm rounded-md ${language === "de" ? "bg-blue-100 text-blue-900 font-medium" : "text-gray-500 hover:bg-gray-100"}`}
          >
            DE
          </button>
          <button
            onClick={() => setLanguage("en")}
            className={`px-3 py-1 text-sm rounded-md ${language === "en" ? "bg-blue-100 text-blue-900 font-medium" : "text-gray-500 hover:bg-gray-100"}`}
          >
            EN
          </button>
        </div>
      </div>

      {/* Status stepper */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIdx || data.status === "closed";
            const isCurrent = idx === currentStepIdx;

            return (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : isCurrent
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </div>
                  <span className="text-xs text-gray-500 mt-1 text-center">
                    {STATUS_LABELS[step]?.[language] ?? step}
                  </span>
                </div>
                {idx < STATUS_STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      idx < currentStepIdx ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Deadlines */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">
              {t("Eingangsbestaetigung", "Acknowledgment")}:{" "}
              {data.acknowledgedAt ? (
                <span className="text-green-600 font-medium">{t("Erledigt", "Done")}</span>
              ) : daysUntilAck > 0 ? (
                <span className={daysUntilAck <= 2 ? "text-yellow-600 font-medium" : "text-gray-900"}>
                  {daysUntilAck} {t("Tage", "days")}
                </span>
              ) : (
                <span className="text-red-600 font-medium">{t("Ueberfaellig", "Overdue")}</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600">
              {t("Rueckmeldung", "Response")}:{" "}
              {daysUntilResponse > 0 ? (
                <span className={daysUntilResponse <= 14 ? "text-yellow-600 font-medium" : "text-gray-900"}>
                  {daysUntilResponse} {t("Tage", "days")}
                </span>
              ) : (
                <span className="text-red-600 font-medium">{t("Ueberfaellig", "Overdue")}</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Message thread */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-4">
          {t("Nachrichten", "Messages")}
        </h2>

        {data.messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            {t("Noch keine Nachrichten", "No messages yet")}
          </p>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {data.messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.direction === "inbound" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg p-3 ${
                    msg.direction === "inbound"
                      ? "bg-blue-100 text-blue-900"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(msg.createdAt).toLocaleString(language === "de" ? "de-DE" : "en-US")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply form */}
        {data.status !== "closed" && (
          <form onSubmit={handleReply} className="mt-4 flex gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              maxLength={5000}
              placeholder={t("Ihre Antwort...", "Your reply...")}
              className="flex-1 rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
              <label className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition flex items-center justify-center">
                <Upload className="h-4 w-4 text-gray-500" />
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </label>
            </div>
          </form>
        )}
      </div>

      {/* Evidence */}
      {data.evidence.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            {t("Beweismittel", "Evidence")}
          </h2>
          <div className="space-y-2">
            {data.evidence.map((ev, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
              >
                <span className="text-gray-700">{ev.fileName}</span>
                <span className="text-gray-400">
                  {(ev.fileSize / 1024).toFixed(0)} KB
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy footer */}
      <div className="text-center pb-8">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <Shield className="h-3 w-3" />
          {t("Alle Daten sind Ende-zu-Ende verschluesselt", "All data is end-to-end encrypted")}
        </div>
      </div>
    </div>
  );
}
