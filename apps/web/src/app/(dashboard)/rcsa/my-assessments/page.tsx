"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  RefreshCcw,
  ClipboardCheck,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AssignmentWithEntity {
  id: string;
  campaignId: string;
  entityType: "risk" | "control";
  entityId: string;
  status: string;
  deadline: string;
  entityTitle?: string;
  entityDepartment?: string;
  entityCategory?: string;
  campaignName?: string;
  response?: Record<string, unknown> | null;
}

export default function MyAssessmentsPage() {
  const t = useTranslations("rcsa");
  const [assignments, setAssignments] = useState<AssignmentWithEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state per assignment
  const [forms, setForms] = useState<Record<string, Record<string, unknown>>>({});

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/rcsa/my-assignments?limit=100");
      if (res.ok) {
        const json = await res.json();
        setAssignments(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAssignments();
  }, [fetchAssignments]);

  const getForm = (assignmentId: string) => forms[assignmentId] ?? {};

  const updateForm = (assignmentId: string, field: string, value: unknown) => {
    setForms((prev) => ({
      ...prev,
      [assignmentId]: {
        ...prev[assignmentId],
        [field]: value,
      },
    }));
  };

  const submitResponse = async (assignment: AssignmentWithEntity) => {
    setSubmitting(assignment.id);
    setError(null);
    try {
      const form = getForm(assignment.id);
      const res = await fetch(`/api/v1/rcsa/assignments/${assignment.id}/respond`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to submit");
      }
      await fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(null);
    }
  };

  const riskAssignments = assignments.filter((a) => a.entityType === "risk");
  const controlAssignments = assignments.filter((a) => a.entityType === "control");
  const totalCompleted = assignments.filter((a) => a.status === "submitted").length;

  if (loading && assignments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const daysUntilDeadline = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("myAssessments.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCompleted} / {assignments.length} {t("myAssessments.completed")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAssignments} disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 rounded-full h-2 transition-all"
          style={{
            width: `${assignments.length > 0 ? (totalCompleted / assignments.length) * 100 : 0}%`,
          }}
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {assignments.length === 0 && (
        <div className="text-center py-16">
          <ClipboardCheck className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm text-gray-500">{t("myAssessments.empty")}</p>
        </div>
      )}

      {/* Risk Assessments */}
      {riskAssignments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" />
            {t("myAssessments.riskAssessments")} ({riskAssignments.length})
          </h2>
          <div className="space-y-4">
            {riskAssignments.map((assignment) => (
              <RiskCard
                key={assignment.id}
                assignment={assignment}
                form={getForm(assignment.id)}
                onUpdate={(field, value) => updateForm(assignment.id, field, value)}
                onSubmit={() => submitResponse(assignment)}
                submitting={submitting === assignment.id}
                daysLeft={daysUntilDeadline(assignment.deadline)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Control Assessments */}
      {controlAssignments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-blue-500" />
            {t("myAssessments.controlAssessments")} ({controlAssignments.length})
          </h2>
          <div className="space-y-4">
            {controlAssignments.map((assignment) => (
              <ControlCard
                key={assignment.id}
                assignment={assignment}
                form={getForm(assignment.id)}
                onUpdate={(field, value) => updateForm(assignment.id, field, value)}
                onSubmit={() => submitResponse(assignment)}
                submitting={submitting === assignment.id}
                daysLeft={daysUntilDeadline(assignment.deadline)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RiskCard({
  assignment,
  form,
  onUpdate,
  onSubmit,
  submitting,
  daysLeft,
  t,
}: {
  assignment: AssignmentWithEntity;
  form: Record<string, unknown>;
  onUpdate: (field: string, value: unknown) => void;
  onSubmit: () => void;
  submitting: boolean;
  daysLeft: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const isSubmitted = assignment.status === "submitted";

  return (
    <div className={`rounded-lg border p-5 ${isSubmitted ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" />
            <h3 className="font-semibold text-gray-900">{assignment.entityTitle ?? assignment.entityId}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {assignment.entityCategory && <span>{assignment.entityCategory} | </span>}
            {assignment.campaignName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSubmitted ? (
            <Badge className="bg-green-100 text-green-700"><Check size={12} className="mr-1" />{t("status.submitted")}</Badge>
          ) : (
            <Badge className={daysLeft <= 3 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}>
              <Clock size={12} className="mr-1" />
              {daysLeft > 0 ? `${daysLeft} ${t("common.daysLeft")}` : t("status.overdue")}
            </Badge>
          )}
        </div>
      </div>

      {!isSubmitted && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("risk.stillRelevant")}</label>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <Button
                  key={String(v)}
                  size="sm"
                  variant={form.riskStillRelevant === v ? "default" : "outline"}
                  onClick={() => onUpdate("riskStillRelevant", v)}
                >
                  {v ? t("common.yes") : t("common.no")}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("risk.likelihood")}: {String(form.likelihoodAssessment ?? "-")}
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={Number(form.likelihoodAssessment ?? 3)}
                onChange={(e) => onUpdate("likelihoodAssessment", Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("risk.impact")}: {String(form.impactAssessment ?? "-")}
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={Number(form.impactAssessment ?? 3)}
                onChange={(e) => onUpdate("impactAssessment", Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("risk.trend")}</label>
            <div className="flex gap-2">
              {(["increasing", "stable", "decreasing"] as const).map((trend) => (
                <Button
                  key={trend}
                  size="sm"
                  variant={form.riskTrend === trend ? "default" : "outline"}
                  onClick={() => onUpdate("riskTrend", trend)}
                >
                  {t(`risk.trend_${trend}`)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.comment")}</label>
            <textarea
              value={String(form.comment ?? "")}
              onChange={(e) => onUpdate("comment", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("common.confidence")}: {String(form.confidence ?? "-")}
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={Number(form.confidence ?? 3)}
              onChange={(e) => onUpdate("confidence", Number(e.target.value))}
              className="w-full"
            />
          </div>

          <Button
            onClick={onSubmit}
            disabled={submitting || form.riskStillRelevant === undefined || !form.likelihoodAssessment || !form.riskTrend}
            className="w-full"
          >
            {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Check size={14} className="mr-1" />}
            {t("myAssessments.submit")}
          </Button>
        </div>
      )}
    </div>
  );
}

function ControlCard({
  assignment,
  form,
  onUpdate,
  onSubmit,
  submitting,
  daysLeft,
  t,
}: {
  assignment: AssignmentWithEntity;
  form: Record<string, unknown>;
  onUpdate: (field: string, value: unknown) => void;
  onSubmit: () => void;
  submitting: boolean;
  daysLeft: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const isSubmitted = assignment.status === "submitted";

  return (
    <div className={`rounded-lg border p-5 ${isSubmitted ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-500" />
            <h3 className="font-semibold text-gray-900">{assignment.entityTitle ?? assignment.entityId}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {assignment.entityCategory && <span>{assignment.entityCategory} | </span>}
            {assignment.campaignName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSubmitted ? (
            <Badge className="bg-green-100 text-green-700"><Check size={12} className="mr-1" />{t("status.submitted")}</Badge>
          ) : (
            <Badge className={daysLeft <= 3 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}>
              <Clock size={12} className="mr-1" />
              {daysLeft > 0 ? `${daysLeft} ${t("common.daysLeft")}` : t("status.overdue")}
            </Badge>
          )}
        </div>
      </div>

      {!isSubmitted && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("control.effectiveness")}</label>
            <div className="flex gap-2">
              {(["effective", "partially_effective", "ineffective"] as const).map((eff) => (
                <Button
                  key={eff}
                  size="sm"
                  variant={form.controlEffectiveness === eff ? "default" : "outline"}
                  onClick={() => onUpdate("controlEffectiveness", eff)}
                  className={
                    form.controlEffectiveness === eff
                      ? eff === "effective"
                        ? "bg-green-600"
                        : eff === "partially_effective"
                          ? "bg-yellow-600"
                          : "bg-red-600"
                      : ""
                  }
                >
                  {t(`control.eff_${eff}`)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("control.operating")}</label>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <Button
                  key={String(v)}
                  size="sm"
                  variant={form.controlOperating === v ? "default" : "outline"}
                  onClick={() => onUpdate("controlOperating", v)}
                >
                  {v ? t("common.yes") : t("common.no")}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("control.weaknesses")}</label>
            <textarea
              value={String(form.controlWeaknesses ?? "")}
              onChange={(e) => onUpdate("controlWeaknesses", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("common.comment")}</label>
            <textarea
              value={String(form.comment ?? "")}
              onChange={(e) => onUpdate("comment", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("common.confidence")}: {String(form.confidence ?? "-")}
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={Number(form.confidence ?? 3)}
              onChange={(e) => onUpdate("confidence", Number(e.target.value))}
              className="w-full"
            />
          </div>

          <Button
            onClick={onSubmit}
            disabled={submitting || !form.controlEffectiveness || form.controlOperating === undefined}
            className="w-full"
          >
            {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : <Check size={14} className="mr-1" />}
            {t("myAssessments.submit")}
          </Button>
        </div>
      )}
    </div>
  );
}
