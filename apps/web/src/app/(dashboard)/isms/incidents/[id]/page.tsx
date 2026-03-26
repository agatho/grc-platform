"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Clock,
  Shield,
  FileText,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

import { ModuleGate } from "@/components/module/module-gate";
import { IncidentSeverityBadge } from "@/components/isms/incident-severity-badge";
import { BreachCountdown } from "@/components/isms/breach-countdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SecurityIncident, IncidentTimelineEntry, IncidentStatus } from "@grc/shared";

const STATUS_ORDER: IncidentStatus[] = [
  "detected",
  "triaged",
  "contained",
  "eradicated",
  "recovered",
  "lessons_learned",
  "closed",
];

const NEXT_STATUS: Record<string, string> = {
  detected: "triaged",
  triaged: "contained",
  contained: "eradicated",
  eradicated: "recovered",
  recovered: "lessons_learned",
  lessons_learned: "closed",
};

const ACTION_TYPE_ICONS: Record<string, string> = {
  detection: "🔍",
  triage: "📋",
  containment: "🛡",
  communication: "📢",
  escalation: "⬆",
  recovery: "🔄",
  eradication: "🧹",
  lessons_learned: "📝",
  other: "📌",
};

export default function IncidentDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <IncidentDetailInner />
    </ModuleGate>
  );
}

function IncidentDetailInner() {
  const t = useTranslations("isms");
  const router = useRouter();
  const params = useParams();
  const incidentId = params.id as string;

  const [incident, setIncident] = useState<SecurityIncident | null>(null);
  const [timeline, setTimeline] = useState<IncidentTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Timeline form
  const [newActionType, setNewActionType] = useState("other");
  const [newDescription, setNewDescription] = useState("");
  const [addingEntry, setAddingEntry] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [incRes, tlRes] = await Promise.all([
        fetch(`/api/v1/isms/incidents/${incidentId}`),
        fetch(`/api/v1/isms/incidents/${incidentId}/timeline`),
      ]);
      if (incRes.ok) {
        const json = await incRes.json();
        setIncident(json.data);
      }
      if (tlRes.ok) {
        const json = await tlRes.json();
        setTimeline(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleStatusTransition = useCallback(async (newStatus: string) => {
    const res = await fetch(`/api/v1/isms/incidents/${incidentId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      toast.success(t("statusUpdated"));
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error ?? t("statusError"));
    }
  }, [incidentId, fetchData, t]);

  const handleAddTimelineEntry = useCallback(async () => {
    if (!newDescription.trim()) return;
    setAddingEntry(true);
    try {
      const res = await fetch(`/api/v1/isms/incidents/${incidentId}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: newActionType,
          description: newDescription,
        }),
      });
      if (res.ok) {
        toast.success(t("timelineEntryAdded"));
        setNewDescription("");
        fetchData();
      }
    } finally {
      setAddingEntry(false);
    }
  }, [incidentId, newActionType, newDescription, fetchData, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="text-center py-12 text-gray-500">
        {t("incidentNotFound")}
      </div>
    );
  }

  const nextStatus = NEXT_STATUS[incident.status];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/isms/incidents")} className="mb-2">
          <ArrowLeft size={14} className="mr-1" /> {t("backToIncidents")}
        </Button>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-gray-400">{incident.elementId}</span>
          <h1 className="text-2xl font-bold text-gray-900">{incident.title}</h1>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <IncidentSeverityBadge severity={incident.severity} />
          <Badge variant="outline">{t(`incidentStatus.${incident.status}`)}</Badge>
          {incident.incidentType && (
            <Badge variant="outline" className="text-[10px]">{incident.incidentType}</Badge>
          )}
        </div>
      </div>

      {/* 72h Breach Warning */}
      {incident.isDataBreach && incident.dataBreachDeadline && (
        <BreachCountdown deadline={incident.dataBreachDeadline} />
      )}

      {/* Status Actions */}
      {nextStatus && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{t("advanceTo")}:</span>
          <Button
            size="sm"
            onClick={() => handleStatusTransition(nextStatus)}
          >
            {t(`incidentStatus.${nextStatus}`)}
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <FileText size={14} /> {t("overview")}
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <Activity size={14} /> {t("timeline")}
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5">
            <Shield size={14} /> {t("affectedAssets")}
          </TabsTrigger>
          <TabsTrigger value="rootcause" className="gap-1.5">
            {t("rootCause")}
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{t("description")}</h3>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {incident.description || "--"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t("detectedAt")}</h3>
                <p className="text-sm text-gray-900">{new Date(incident.detectedAt).toLocaleString()}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t("dataBreach")}</h3>
                <p className="text-sm text-gray-900">{incident.isDataBreach ? "Yes" : "No"}</p>
              </div>
              {incident.closedAt && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">{t("closedAt")}</h3>
                  <p className="text-sm text-gray-900">{new Date(incident.closedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-4 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t("noTimelineEntries")}</p>
            ) : (
              <div className="relative space-y-6 pl-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-gray-200">
                {timeline.map((entry) => (
                  <div key={entry.id} className="relative">
                    <div className="absolute -left-8 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">
                      {ACTION_TYPE_ICONS[entry.actionType] ?? "o"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {new Date(entry.occurredAt).toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {entry.actionType}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-900 mt-1">{entry.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Entry Form */}
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-700">{t("addTimelineEntry")}</h4>
              <div className="flex gap-2">
                <select
                  value={newActionType}
                  onChange={(e) => setNewActionType(e.target.value)}
                  className="h-9 rounded-md border border-gray-300 px-2 text-sm"
                >
                  {[
                    "detection",
                    "triage",
                    "containment",
                    "communication",
                    "escalation",
                    "recovery",
                    "eradication",
                    "lessons_learned",
                    "other",
                  ].map((at) => (
                    <option key={at} value={at}>{at}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                placeholder={t("timelineEntryPlaceholder")}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <Button
                size="sm"
                onClick={handleAddTimelineEntry}
                disabled={addingEntry || !newDescription.trim()}
              >
                {addingEntry && <Loader2 size={14} className="mr-1 animate-spin" />}
                {t("addEntry")}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Affected Assets */}
        <TabsContent value="assets" className="mt-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            {incident.affectedAssetIds.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t("noAffectedAssets")}</p>
            ) : (
              <div className="space-y-2">
                {incident.affectedAssetIds.map((assetId) => (
                  <div key={assetId} className="flex items-center gap-2 rounded-lg border border-gray-100 p-3">
                    <Shield size={14} className="text-gray-400" />
                    <span className="font-mono text-xs text-gray-600">{assetId}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Root Cause */}
        <TabsContent value="rootcause" className="mt-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{t("rootCause")}</h3>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {incident.rootCause || "--"}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{t("remediationActions")}</h3>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {incident.remediationActions || "--"}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{t("lessonsLearned")}</h3>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {incident.lessonsLearned || "--"}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
