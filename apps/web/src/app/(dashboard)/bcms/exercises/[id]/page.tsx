"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Plus, CheckCircle } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BcExercise, BcExerciseFinding, ExerciseResult } from "@grc/shared";

const RESULT_COLORS: Record<string, string> = {
  successful: "bg-green-100 text-green-900",
  partially_successful: "bg-yellow-100 text-yellow-900",
  failed: "bg-red-100 text-red-900",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-900",
  major: "bg-orange-100 text-orange-900",
  minor: "bg-yellow-100 text-yellow-900",
  observation: "bg-blue-100 text-blue-900",
};

export default function ExerciseDetailPage() {
  return (
    <ModuleGate moduleKey="bcms">
      <ExerciseDetailInner />
    </ModuleGate>
  );
}

function ExerciseDetailInner() {
  const t = useTranslations("bcms");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [exercise, setExercise] = useState<BcExercise | null>(null);
  const [findings, setFindings] = useState<BcExerciseFinding[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "objectives" | "findings" | "lessons">("overview");
  const [loading, setLoading] = useState(true);

  // Complete form
  const [showComplete, setShowComplete] = useState(false);
  const [completeResult, setCompleteResult] = useState<ExerciseResult>("successful");
  const [completeDate, setCompleteDate] = useState(new Date().toISOString().split("T")[0]);
  const [completeDuration, setCompleteDuration] = useState<number>(1);
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [completing, setCompleting] = useState(false);

  // Finding form
  const [showAddFinding, setShowAddFinding] = useState(false);
  const [findingTitle, setFindingTitle] = useState("");
  const [findingSeverity, setFindingSeverity] = useState("minor");
  const [findingDesc, setFindingDesc] = useState("");
  const [addingFinding, setAddingFinding] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, fRes] = await Promise.all([
        fetch(`/api/v1/bcms/exercises/${id}`),
        fetch(`/api/v1/bcms/exercises/${id}/findings?limit=100`),
      ]);
      if (eRes.ok) { const j = await eRes.json(); setExercise(j.data); }
      if (fRes.ok) { const j = await fRes.json(); setFindings(j.data ?? []); }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const objectives = exercise?.objectives ?? [];
      const res = await fetch(`/api/v1/bcms/exercises/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualDate: completeDate,
          actualDurationHours: completeDuration,
          overallResult: completeResult,
          lessonsLearned: lessonsLearned || undefined,
          objectives: Array.isArray(objectives) ? objectives : [],
        }),
      });
      if (res.ok) {
        setShowComplete(false);
        void fetchData();
      }
    } finally {
      setCompleting(false);
    }
  };

  const handleAddFinding = async () => {
    if (!findingTitle.trim()) return;
    setAddingFinding(true);
    try {
      const res = await fetch(`/api/v1/bcms/exercises/${id}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: findingTitle,
          severity: findingSeverity,
          description: findingDesc || undefined,
        }),
      });
      if (res.ok) {
        setFindingTitle("");
        setFindingDesc("");
        setShowAddFinding(false);
        void fetchData();
      }
    } finally {
      setAddingFinding(false);
    }
  };

  if (loading && !exercise) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!exercise) {
    return <p className="text-center text-gray-400 py-12">{t("exercise.notFound")}</p>;
  }

  const isCompleted = exercise.status === "completed";
  const objectives = Array.isArray(exercise.objectives) ? (exercise.objectives as Array<{ title: string; met: boolean; notes?: string }>) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/bcms/exercises")} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{exercise.title}</h1>
            <p className="text-sm text-gray-500">
              {t(`exercise.type.${exercise.exerciseType}`)} | {exercise.plannedDate}
              {exercise.overallResult && (
                <Badge variant="outline" className={`ml-2 ${RESULT_COLORS[exercise.overallResult]}`}>
                  {t(`exercise.result.${exercise.overallResult}`)}
                </Badge>
              )}
            </p>
          </div>
        </div>
        {!isCompleted && (
          <Button onClick={() => setShowComplete(true)}>
            <CheckCircle size={14} className="mr-1" /> {t("exercise.complete")}
          </Button>
        )}
      </div>

      {/* Complete form */}
      {showComplete && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
          <h3 className="font-semibold text-green-900">{t("exercise.complete")}</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("exercise.actualDate")}</label>
              <input
                type="date"
                value={completeDate}
                onChange={(e) => setCompleteDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("exercise.duration")} (h)</label>
              <input
                type="number"
                value={completeDuration}
                onChange={(e) => setCompleteDuration(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Result</label>
              <select
                value={completeResult}
                onChange={(e) => setCompleteResult(e.target.value as ExerciseResult)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {["successful", "partially_successful", "failed"].map((r) => (
                  <option key={r} value={r}>{t(`exercise.result.${r}`)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("exercise.lessonsLearned")}</label>
            <textarea
              value={lessonsLearned}
              onChange={(e) => setLessonsLearned(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleComplete} disabled={completing}>
              {completing ? <Loader2 size={14} className="animate-spin" /> : t("common.save")}
            </Button>
            <Button variant="outline" onClick={() => setShowComplete(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["overview", "objectives", "findings", "lessons"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "overview"
              ? t("bcp.overview")
              : tab === "objectives"
                ? t("exercise.objectives")
                : tab === "findings"
                  ? `${t("exercise.findings")} (${findings.length})`
                  : t("exercise.lessonsLearned")}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-gray-500">{t("common.description")}</dt>
              <dd className="text-sm text-gray-900 mt-1">{exercise.description || "-"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">{t("common.status")}</dt>
              <dd className="mt-1">
                <Badge variant="outline" className={exercise.status === "completed" ? "bg-green-100 text-green-900" : "bg-gray-100 text-gray-600"}>
                  {t(`exercise.status.${exercise.status}`)}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">{t("exercise.plannedDate")}</dt>
              <dd className="text-sm text-gray-900 mt-1">{exercise.plannedDate}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">{t("exercise.duration")}</dt>
              <dd className="text-sm text-gray-900 mt-1">{exercise.plannedDurationHours ?? "-"}h planned{exercise.actualDurationHours ? ` / ${exercise.actualDurationHours}h actual` : ""}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Objectives */}
      {activeTab === "objectives" && (
        <div className="space-y-2">
          {objectives.length === 0 ? (
            <p className="text-center text-gray-400 py-8">{t("common.noData")}</p>
          ) : (
            objectives.map((obj, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${obj.met ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                  {obj.met ? <CheckCircle size={14} /> : <span className="text-xs">{idx + 1}</span>}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{obj.title}</p>
                  {obj.notes && <p className="text-xs text-gray-500 mt-0.5">{obj.notes}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Findings */}
      {activeTab === "findings" && (
        <div className="space-y-4">
          {showAddFinding ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={findingTitle}
                  onChange={(e) => setFindingTitle(e.target.value)}
                  placeholder={t("common.name")}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <select
                  value={findingSeverity}
                  onChange={(e) => setFindingSeverity(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {["critical", "major", "minor", "observation"].map((s) => (
                    <option key={s} value={s}>{t(`exercise.findingSeverity.${s}`)}</option>
                  ))}
                </select>
              </div>
              <textarea
                value={findingDesc}
                onChange={(e) => setFindingDesc(e.target.value)}
                placeholder={t("common.description")}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={2}
              />
              <div className="flex gap-2">
                <Button onClick={handleAddFinding} disabled={addingFinding} size="sm">
                  {addingFinding ? <Loader2 size={14} className="animate-spin" /> : t("common.save")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddFinding(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddFinding(true)}>
              <Plus size={14} className="mr-1" /> {t("exercise.addFinding")}
            </Button>
          )}

          {findings.length === 0 ? (
            <p className="text-center text-gray-400 py-8">{t("common.noData")}</p>
          ) : (
            <div className="space-y-2">
              {findings.map((finding) => (
                <div key={finding.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{finding.title}</p>
                        <Badge variant="outline" className={SEVERITY_COLORS[finding.severity]}>
                          {t(`exercise.findingSeverity.${finding.severity}`)}
                        </Badge>
                      </div>
                      {finding.description && <p className="text-sm text-gray-500 mt-1">{finding.description}</p>}
                      {finding.recommendation && (
                        <p className="text-xs text-blue-600 mt-2">Recommendation: {finding.recommendation}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lessons Learned */}
      {activeTab === "lessons" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          {exercise.lessonsLearned ? (
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-gray-700">{exercise.lessonsLearned}</p>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">{t("common.noData")}</p>
          )}
        </div>
      )}
    </div>
  );
}
