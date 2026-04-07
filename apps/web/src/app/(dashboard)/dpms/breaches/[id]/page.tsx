"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, AlertTriangle, Send, XCircle } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DataBreach, DataBreachNotification } from "@grc/shared";

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-900",
  medium: "bg-yellow-100 text-yellow-900",
  high: "bg-orange-100 text-orange-900",
  critical: "bg-red-100 text-red-900",
};

export default function BreachDetailPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <BreachDetailInner />
    </ModuleGate>
  );
}

interface BreachDetailData extends DataBreach {
  notifications: DataBreachNotification[];
  assigneeName?: string;
}

function BreachDetailInner() {
  const t = useTranslations("dpms");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<BreachDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "assessment" | "measures" | "notifications" | "lessons">("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/dpms/breaches/${id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleDpaNotify = async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/v1/dpms/breaches/${id}/dpa-notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientType: "dpa" }),
      });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setActing(false);
    }
  };

  const handleClose = async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/v1/dpms/breaches/${id}/close`, { method: "POST" });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setActing(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-gray-500 py-8">{t("breaches.notFound")}</p>;
  }

  const detectedAt = new Date(data.detectedAt);
  const deadline72h = new Date(detectedAt.getTime() + 72 * 60 * 60 * 1000);
  const now = new Date();
  const msRemaining = Math.max(0, deadline72h.getTime() - now.getTime());
  const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const progress72h = Math.min(100, Math.round(((72 * 60 * 60 * 1000 - msRemaining) / (72 * 60 * 60 * 1000)) * 100));
  const isOverdue = msRemaining === 0;
  const isClosed = data.status === "closed";

  const tabs = ["overview", "assessment", "measures", "notifications", "lessons"] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dpms/breaches")}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={SEVERITY_COLORS[data.severity] ?? ""}>
                {data.severity}
              </Badge>
              <Badge variant="outline">{data.status.replace(/_/g, " ")}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* 72h Countdown */}
      {!isClosed && !data.dpaNotifiedAt && (
        <div className={`rounded-lg border-2 p-6 ${isOverdue ? "border-red-300 bg-red-50" : "border-orange-300 bg-orange-50"}`}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className={`h-5 w-5 ${isOverdue ? "text-red-600" : "text-orange-600"}`} />
            <span className={`font-semibold ${isOverdue ? "text-red-800" : "text-orange-800"}`}>
              {t("breaches.countdown")} (Art. 33 GDPR)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-3">
            <div
              className={`h-4 rounded-full transition-all ${isOverdue ? "bg-red-500" : progress72h > 75 ? "bg-orange-500" : "bg-yellow-500"}`}
              style={{ width: `${progress72h}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              {t("breaches.detected")}: {detectedAt.toLocaleString()}
            </span>
            <span className={`font-bold ${isOverdue ? "text-red-700" : "text-orange-700"}`}>
              {isOverdue
                ? t("breaches.expired")
                : `${hoursRemaining}h ${minutesRemaining}m ${t("breaches.remaining")}`}
            </span>
          </div>
          <div className="flex gap-3 mt-4">
            <Button size="sm" onClick={handleDpaNotify} disabled={acting}>
              <Send size={14} className="mr-1" />
              {t("breaches.dpaNotification")}
            </Button>
          </div>
        </div>
      )}

      {data.dpaNotifiedAt && !isClosed && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <span className="text-sm text-green-700 font-medium">
            {t("breaches.dpaNotified")} - {new Date(data.dpaNotifiedAt).toLocaleString()}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t(`breaches.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <FieldRow label={t("breaches.description")} value={data.description ?? "-"} />
              <FieldRow label={t("breaches.personalDataAffected")} value={data.isDpaNotificationRequired ? t("ropa.yes") : t("ropa.no")} />
              <FieldRow label={t("breaches.dataCategoriesAffected")} value={data.dataCategoriesAffected?.join(", ") ?? "-"} />
              <FieldRow label={t("breaches.estimatedRecords")} value={data.estimatedRecordsAffected?.toString() ?? "-"} />
            </div>
            <div className="space-y-4">
              <FieldRow label={t("breaches.affectedCountries")} value={data.affectedCountries?.join(", ") ?? "-"} />
              <FieldRow label={t("breaches.assignee")} value={data.assigneeName ?? "-"} />
              <FieldRow label={t("breaches.detected")} value={detectedAt.toLocaleString()} />
            </div>
          </div>
        )}

        {activeTab === "assessment" && (
          <div className="space-y-4">
            <FieldRow label={t("breaches.severity")} value={data.severity} />
            <FieldRow label={t("breaches.dpaRequired")} value={data.isDpaNotificationRequired ? t("ropa.yes") : t("ropa.no")} />
            <FieldRow label={t("breaches.individualsRequired")} value={data.isIndividualNotificationRequired ? t("ropa.yes") : t("ropa.no")} />
          </div>
        )}

        {activeTab === "measures" && (
          <div className="space-y-4">
            <FieldRow label={t("breaches.containment")} value={data.containmentMeasures ?? "-"} />
            <FieldRow label={t("breaches.remediation")} value={data.remediationMeasures ?? "-"} />
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="space-y-3">
            {data.notifications.length === 0 ? (
              <p className="text-sm text-gray-400">{t("breaches.noNotifications")}</p>
            ) : (
              data.notifications.map((notif) => (
                <div key={notif.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div>
                    <Badge variant="outline" className="text-xs mr-2">{notif.recipientType}</Badge>
                    <span className="text-sm text-gray-700">{notif.recipientEmail ?? "-"}</span>
                  </div>
                  <span className="text-xs text-gray-500">{notif.sentAt ? new Date(notif.sentAt).toLocaleString() : "-"}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "lessons" && (
          <div className="space-y-4">
            <FieldRow label={t("breaches.lessonsLearned")} value={data.lessonsLearned ?? "-"} />
          </div>
        )}
      </div>

      {/* Close button */}
      {data.status === "remediation" && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={acting}>
            <XCircle size={14} className="mr-1" />
            {t("breaches.closeBreach")}
          </Button>
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5">{value}</dd>
    </div>
  );
}
