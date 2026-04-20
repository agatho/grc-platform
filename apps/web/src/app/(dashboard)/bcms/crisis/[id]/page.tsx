"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  AlertTriangle,
  Plus,
  Trash2,
  Shield,
  ArrowRight,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CrisisScenario, CrisisLog as CrisisLogEntry } from "@grc/shared";

interface TeamMember {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  role: string;
  isPrimary: boolean;
  phoneNumber?: string;
}

const LOG_TYPE_ICONS: Record<string, string> = {
  decision: "D",
  communication: "C",
  action: "A",
  status_change: "S",
  observation: "O",
};

export default function CrisisDetailPage() {
  return (
    <ModuleGate moduleKey="bcms">
      <CrisisDetailInner />
    </ModuleGate>
  );
}

function CrisisDetailInner() {
  const t = useTranslations("bcms");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [crisis, setCrisis] = useState<CrisisScenario | null>(null);
  const [logEntries, setLogEntries] = useState<CrisisLogEntry[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [activeTab, setActiveTab] = useState<"log" | "team">("log");
  const [loading, setLoading] = useState(true);

  // Log entry form
  const [showAddLog, setShowAddLog] = useState(false);
  const [logType, setLogType] = useState("action");
  const [logTitle, setLogTitle] = useState("");
  const [logDesc, setLogDesc] = useState("");
  const [addingLog, setAddingLog] = useState(false);

  // Risk Assessment (ERM Bridge)
  const [likelihood, setLikelihood] = useState<number>(0);
  const [treatmentStrategy, setTreatmentStrategy] = useState<string>("");
  const [savingRisk, setSavingRisk] = useState(false);
  const [syncingErm, setSyncingErm] = useState(false);

  // Actions
  const [activating, setActivating] = useState(false);
  const [resolving, setResolving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, lRes, tRes] = await Promise.all([
        fetch(`/api/v1/bcms/crisis/${id}`),
        fetch(`/api/v1/bcms/crisis/${id}/log?limit=100`),
        fetch(`/api/v1/bcms/crisis/${id}/team?limit=50`),
      ]);
      if (cRes.ok) {
        const j = await cRes.json();
        setCrisis(j.data);
        if (j.data.likelihood) setLikelihood(j.data.likelihood);
        if (j.data.treatmentStrategy)
          setTreatmentStrategy(j.data.treatmentStrategy);
      }
      if (lRes.ok) {
        const j = await lRes.json();
        setLogEntries(j.data ?? []);
      }
      if (tRes.ok) {
        const j = await tRes.json();
        setTeam(j.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleActivate = async () => {
    setActivating(true);
    try {
      const res = await fetch(`/api/v1/bcms/crisis/${id}/activate`, {
        method: "POST",
      });
      if (res.ok) void fetchData();
    } finally {
      setActivating(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      const res = await fetch(`/api/v1/bcms/crisis/${id}/resolve`, {
        method: "POST",
      });
      if (res.ok) void fetchData();
    } finally {
      setResolving(false);
    }
  };

  const handleAddLog = async () => {
    if (!logTitle.trim()) return;
    setAddingLog(true);
    try {
      const res = await fetch(`/api/v1/bcms/crisis/${id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryType: logType,
          title: logTitle,
          description: logDesc || undefined,
        }),
      });
      if (res.ok) {
        setLogTitle("");
        setLogDesc("");
        setShowAddLog(false);
        void fetchData();
      }
    } finally {
      setAddingLog(false);
    }
  };

  const handleRemoveTeamMember = async (memberId: string) => {
    await fetch(`/api/v1/bcms/crisis/${id}/team/${memberId}`, {
      method: "DELETE",
    });
    void fetchData();
  };

  // ── Risk Assessment helpers ──
  const SEVERITY_MAP: Record<string, number> = {
    low: 1,
    moderate: 2,
    high: 3,
    very_high: 4,
    catastrophic: 5,
  };
  const severityLevel = crisis ? (SEVERITY_MAP[crisis.severity] ?? 3) : 0;
  const riskScore = likelihood * severityLevel;

  const LIKELIHOOD_LABELS: Record<number, string> = {
    1: "Sehr niedrig",
    2: "Niedrig",
    3: "Mittel",
    4: "Hoch",
    5: "Sehr hoch",
  };

  const TREATMENT_OPTIONS = [
    { value: "mitigate", label: "Mindern" },
    { value: "accept", label: "Akzeptieren" },
    { value: "transfer", label: "Transferieren" },
    { value: "avoid", label: "Vermeiden" },
  ];

  function riskColor(score: number): string {
    if (score >= 20) return "bg-red-600 text-white";
    if (score >= 15) return "bg-red-500 text-white";
    if (score >= 9) return "bg-orange-500 text-white";
    if (score >= 4) return "bg-yellow-400 text-yellow-900";
    return "bg-green-400 text-green-900";
  }

  function riskLabel(score: number): string {
    if (score >= 20) return "Kritisch";
    if (score >= 15) return "Sehr hoch";
    if (score >= 9) return "Hoch";
    if (score >= 4) return "Mittel";
    return "Niedrig";
  }

  const handleSaveRiskAssessment = async () => {
    if (!likelihood) return;
    setSavingRisk(true);
    try {
      const res = await fetch(`/api/v1/bcms/crisis/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          likelihood,
          riskScore: likelihood * severityLevel,
          treatmentStrategy: treatmentStrategy || null,
        }),
      });
      if (res.ok) void fetchData();
    } finally {
      setSavingRisk(false);
    }
  };

  const handleErmSync = async () => {
    setSyncingErm(true);
    try {
      const res = await fetch("/api/v1/bcms/erm-sync", { method: "POST" });
      if (res.ok) void fetchData();
    } finally {
      setSyncingErm(false);
    }
  };

  if (loading && !crisis) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!crisis) {
    return (
      <p className="text-center text-gray-400 py-12">{t("crisis.notFound")}</p>
    );
  }

  const isActive = crisis.status === "activated";
  const duration = crisis.activatedAt
    ? Math.round((Date.now() - new Date(crisis.activatedAt).getTime()) / 60000)
    : 0;
  const durationHours = Math.floor(duration / 60);
  const durationMins = duration % 60;

  return (
    <div className="space-y-6">
      {/* Active Crisis Header */}
      {isActive && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="font-bold text-red-800 text-lg">
                {crisis.name}
              </span>
              <Badge variant="outline" className="bg-red-100 text-red-900 ml-2">
                {crisis.severity.replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-red-700">
                {t("crisis.duration")}: {durationHours}h {durationMins}m
              </p>
              <p className="text-xs text-red-600">
                {t("crisis.activatedAt")}:{" "}
                {crisis.activatedAt
                  ? new Date(crisis.activatedAt).toLocaleString()
                  : "-"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      {!isActive && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/bcms/crisis")}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{crisis.name}</h1>
            <p className="text-sm text-gray-500">
              {t(`crisis.categories.${crisis.category}`)} |{" "}
              {crisis.severity.replace(/_/g, " ")}
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              crisis.status === "resolved"
                ? "bg-green-100 text-green-900"
                : "bg-gray-100 text-gray-600"
            }
          >
            {t(`crisis.status.${crisis.status}`)}
          </Badge>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {crisis.status === "standby" && (
          <Button
            onClick={handleActivate}
            disabled={activating}
            className="bg-red-600 hover:bg-red-700"
          >
            {activating ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : (
              <AlertTriangle size={14} className="mr-1" />
            )}
            {t("crisis.activate")}
          </Button>
        )}
        {isActive && (
          <Button
            onClick={handleResolve}
            disabled={resolving}
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            {resolving ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : null}
            {t("crisis.resolve")}
          </Button>
        )}
        <button
          onClick={() => router.push("/bcms/crisis")}
          className="text-sm text-gray-500 hover:text-gray-700 ml-auto"
        >
          {t("common.back")}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["log", "team"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "log" ? t("crisis.log") : t("crisis.team")}
          </button>
        ))}
      </div>

      {/* ── Risikobewertung (ERM Bridge) ── */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Shield size={16} className="text-blue-600" />
            Risikobewertung
          </h2>
          {Boolean(
            (crisis as unknown as Record<string, unknown>).ermRiskId,
          ) && (
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              <ArrowRight size={10} className="mr-1" /> ERM-Register
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Likelihood selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Eintrittswahrscheinlichkeit
            </label>
            <select
              value={likelihood}
              onChange={(e) => setLikelihood(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value={0}>-- Auswahl --</option>
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v} - {LIKELIHOOD_LABELS[v]}
                </option>
              ))}
            </select>
          </div>

          {/* Severity (read-only) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Schweregrad (aus Szenario)
            </label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {severityLevel} - {crisis.severity.replace(/_/g, " ")}
            </div>
          </div>

          {/* Risk Score */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Risikobewertung (L x S)
            </label>
            {likelihood > 0 ? (
              <div
                className={`rounded-md px-3 py-2 text-sm font-bold text-center ${riskColor(riskScore)}`}
              >
                {riskScore} - {riskLabel(riskScore)}
              </div>
            ) : (
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 text-center">
                --
              </div>
            )}
          </div>

          {/* Treatment Strategy */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Behandlungsstrategie
            </label>
            <select
              value={treatmentStrategy}
              onChange={(e) => setTreatmentStrategy(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">-- Auswahl --</option>
              {TREATMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <Button
            size="sm"
            onClick={handleSaveRiskAssessment}
            disabled={savingRisk || !likelihood}
          >
            {savingRisk ? (
              <Loader2 size={14} className="animate-spin mr-1" />
            ) : null}
            Bewertung speichern
          </Button>
          {likelihood > 0 &&
            riskScore >= 12 &&
            !(crisis as unknown as Record<string, unknown>).ermRiskId && (
              <Button
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={handleErmSync}
                disabled={syncingErm}
              >
                {syncingErm ? (
                  <Loader2 size={14} className="animate-spin mr-1" />
                ) : (
                  <ArrowRight size={14} className="mr-1" />
                )}
                Ins ERM synchronisieren
              </Button>
            )}
          {Boolean(
            (crisis as unknown as Record<string, unknown>).ermSyncedAt,
          ) && (
            <span className="text-xs text-gray-400 ml-auto">
              Synchronisiert:{" "}
              {new Date(
                (crisis as unknown as Record<string, unknown>)
                  .ermSyncedAt as string,
              ).toLocaleString("de-DE")}
            </span>
          )}
        </div>
      </div>

      {/* Log Tab */}
      {activeTab === "log" && (
        <div className="space-y-4">
          {/* Add log entry */}
          {(isActive || crisis.status === "standby") && (
            <>
              {showAddLog ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <div className="flex gap-3">
                    <select
                      value={logType}
                      onChange={(e) => setLogType(e.target.value)}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      {[
                        "action",
                        "decision",
                        "communication",
                        "status_change",
                        "observation",
                      ].map((type) => (
                        <option key={type} value={type}>
                          {t(`crisis.logEntry.${type}`)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={logTitle}
                      onChange={(e) => setLogTitle(e.target.value)}
                      placeholder={t("common.name")}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <textarea
                    value={logDesc}
                    onChange={(e) => setLogDesc(e.target.value)}
                    placeholder={t("common.description")}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddLog}
                      disabled={addingLog}
                      size="sm"
                    >
                      {addingLog ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        t("crisis.addLogEntry")
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddLog(false)}
                    >
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setShowAddLog(true)}>
                  <Plus size={14} className="mr-1" /> {t("crisis.addLogEntry")}
                </Button>
              )}
            </>
          )}

          {/* Timeline */}
          {logEntries.length === 0 ? (
            <p className="text-center text-gray-400 py-8">
              {t("common.noData")}
            </p>
          ) : (
            <div className="space-y-0">
              {logEntries.map((entry, idx) => (
                <div key={entry.id} className="flex gap-4 pb-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        entry.entryType === "status_change"
                          ? "bg-red-100 text-red-900"
                          : entry.entryType === "decision"
                            ? "bg-purple-100 text-purple-900"
                            : entry.entryType === "communication"
                              ? "bg-blue-100 text-blue-900"
                              : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {LOG_TYPE_ICONS[entry.entryType] ?? "?"}
                    </div>
                    {idx < logEntries.length - 1 && (
                      <div className="w-px flex-1 bg-gray-200 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-400">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {t(`crisis.logEntry.${entry.entryType}`)}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {entry.title}
                    </p>
                    {entry.description && (
                      <p className="text-sm text-gray-500 mt-1">
                        {entry.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team Tab */}
      {activeTab === "team" && (
        <div className="space-y-4">
          {team.length === 0 ? (
            <p className="text-center text-gray-400 py-8">
              {t("common.noData")}
            </p>
          ) : (
            <div className="space-y-2">
              {team.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium text-sm">
                      {(member.userName || member.userEmail || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {member.userName || member.userEmail || member.userId}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">
                          {t(`crisis.teamRoles.${member.role}`)}
                        </Badge>
                        {member.isPrimary && (
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 text-[10px]"
                          >
                            Primary
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {member.phoneNumber && (
                      <span className="text-xs text-gray-500">
                        {member.phoneNumber}
                      </span>
                    )}
                    <button
                      onClick={() => handleRemoveTeamMember(member.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
