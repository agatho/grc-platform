"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, CheckCircle, Send, XCircle } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Dsr, DsrActivity } from "@grc/shared";

export default function DsrDetailPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <DsrDetailInner />
    </ModuleGate>
  );
}

interface DsrDetailData extends Dsr {
  activities: DsrActivity[];
  handlerName?: string;
}

function DsrDetailInner() {
  const t = useTranslations("dpms");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DsrDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/dpms/dsr/${id}`);
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

  const performAction = async (endpoint: string) => {
    setActing(true);
    try {
      const res = await fetch(`/api/v1/dpms/dsr/${id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
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
    return <p className="text-center text-gray-500 py-8">{t("dsr.notFound")}</p>;
  }

  const deadline = new Date(data.deadline);
  const receivedAt = new Date(data.receivedAt);
  const now = new Date();
  const totalDays = 30;
  const elapsedDays = Math.max(0, Math.floor((now.getTime() - receivedAt.getTime()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const progress = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

  let slaColor = "bg-green-500";
  let slaTextColor = "text-green-700";
  if (daysRemaining <= 5) {
    slaColor = "bg-red-500";
    slaTextColor = "text-red-700";
  } else if (daysRemaining <= 15) {
    slaColor = "bg-yellow-500";
    slaTextColor = "text-yellow-700";
  }

  const isClosed = data.status === "closed" || data.status === "rejected";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dpms/dsr")}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("dsr.requestType." + data.requestType)} - {data.subjectName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{data.status.replace(/_/g, " ")}</Badge>
            <span className="text-sm text-gray-500">{t("dsr.deadline")}: {deadline.toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* SLA Timer */}
      {!isClosed && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t("dsr.slaTimer")}</h2>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
            <div
              className={`h-4 rounded-full transition-all ${slaColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t("dsr.day")} {elapsedDays} {t("dsr.of")} {totalDays}</span>
            <span className={`font-medium ${slaTextColor}`}>
              {daysRemaining} {t("dsr.daysRemaining")}
            </span>
          </div>
        </div>
      )}

      {/* Detail Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">{t("dsr.overview")}</h2>
          <FieldRow label={t("dsr.type")} value={data.requestType} />
          <FieldRow label={t("dsr.subject")} value={data.subjectName ?? "-"} />
          <FieldRow label={t("dsr.email")} value={data.subjectEmail ?? "-"} />
          <FieldRow label={t("dsr.received")} value={receivedAt.toLocaleDateString()} />
          <FieldRow label={t("dsr.verified")} value={data.verifiedAt ? new Date(data.verifiedAt).toLocaleDateString() : "-"} />
          <FieldRow label={t("dsr.handler")} value={(data as DsrDetailData).handlerName ?? "-"} />
          {data.notes && <FieldRow label={t("dsr.notes")} value={data.notes} />}
        </div>

        {/* Actions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">{t("dsr.actions")}</h2>
          {data.status === "received" && (
            <Button size="sm" onClick={() => performAction("verify")} disabled={acting} className="w-full">
              <CheckCircle size={14} className="mr-1" />
              {t("dsr.verifyIdentity")}
            </Button>
          )}
          {data.status === "verified" && (
            <Button
              size="sm"
              onClick={async () => {
                setActing(true);
                try {
                  await fetch(`/api/v1/dpms/dsr/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                  });
                  // Transition to processing
                  await fetch(`/api/v1/dpms/dsr/${id}/activity`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ activityType: "data_collection", details: "Started processing" }),
                  });
                  await fetchData();
                } finally {
                  setActing(false);
                }
              }}
              disabled={acting}
              className="w-full"
            >
              {t("dsr.startProcessing")}
            </Button>
          )}
          {data.status === "processing" && (
            <Button size="sm" onClick={() => performAction("respond")} disabled={acting} className="w-full">
              <Send size={14} className="mr-1" />
              {t("dsr.sendResponse")}
            </Button>
          )}
          {(data.status === "response_sent" || data.status === "rejected") && (
            <Button size="sm" onClick={() => performAction("close")} disabled={acting} className="w-full" variant="outline">
              <XCircle size={14} className="mr-1" />
              {t("dsr.close")}
            </Button>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 mb-4">{t("dsr.activityLog")}</h2>
        {data.activities.length === 0 ? (
          <p className="text-sm text-gray-400">{t("dsr.noActivity")}</p>
        ) : (
          <div className="space-y-3">
            {data.activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 text-sm">
                <span className="text-xs text-gray-400 shrink-0 mt-0.5 w-20">
                  {new Date(activity.timestamp).toLocaleDateString()}
                </span>
                <div>
                  <Badge variant="outline" className="text-[10px] mr-2">{activity.activityType}</Badge>
                  <span className="text-gray-700">{activity.details}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
