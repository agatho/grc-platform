"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Save } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ManagementReview, ReviewStatus } from "@grc/shared";

interface ActionItem {
  title: string;
  responsible: string;
  dueDate: string;
  status: string;
}

interface Decision {
  text: string;
  decidedAt?: string;
}

export default function ReviewDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ReviewDetailInner />
    </ModuleGate>
  );
}

function ReviewDetailInner() {
  const t = useTranslations("ismsAssessment");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [review, setReview] = useState<ManagementReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "inputs" | "decisions" | "actions" | "minutes"
  >("inputs");

  // Form state for editing
  const [changesInContext, setChangesInContext] = useState("");
  const [performanceFeedback, setPerformanceFeedback] = useState("");
  const [auditResults, setAuditResults] = useState("");
  const [improvementOpportunities, setImprovementOpportunities] = useState("");
  const [minutes, setMinutes] = useState("");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  const fetchReview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/isms/reviews/${id}`);
      if (res.ok) {
        const json = await res.json();
        const r = json.data as ManagementReview;
        setReview(r);
        setChangesInContext(r.changesInContext ?? "");
        setPerformanceFeedback(r.performanceFeedback ?? "");
        setAuditResults(r.auditResults ?? "");
        setImprovementOpportunities(r.improvementOpportunities ?? "");
        setMinutes(r.minutes ?? "");
        setDecisions(
          Array.isArray(r.decisions) ? (r.decisions as Decision[]) : [],
        );
        setActionItems(
          Array.isArray(r.actionItems) ? (r.actionItems as ActionItem[]) : [],
        );
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchReview();
  }, [fetchReview]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/v1/isms/reviews/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changesInContext,
          performanceFeedback,
          auditResults,
          improvementOpportunities,
          minutes,
          decisions,
          actionItems,
        }),
      });
      void fetchReview();
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    await fetch(`/api/v1/isms/reviews/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    void fetchReview();
  };

  const addDecision = () => {
    setDecisions([...decisions, { text: "" }]);
  };

  const addAction = () => {
    setActionItems([
      ...actionItems,
      { title: "", responsible: "", dueDate: "", status: "open" },
    ]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!review) {
    return (
      <p className="text-center text-gray-400 py-12">{t("review.notFound")}</p>
    );
  }

  const STATUS_COLORS: Record<ReviewStatus, string> = {
    planned: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-900",
    completed: "bg-green-100 text-green-900",
    cancelled: "bg-red-100 text-red-900",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/isms/reviews")}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{review.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline" className={STATUS_COLORS[review.status]}>
                {t(`review.statuses.${review.status}`)}
              </Badge>
              <span className="text-sm text-gray-500">
                {t("review.date")}: {review.reviewDate}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={14} className="mr-1" /> {t("actions.save")}
          </Button>
          {review.status !== "completed" && (
            <Button size="sm" onClick={handleComplete}>
              {t("review.complete")}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["inputs", "decisions", "actions", "minutes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t(`review.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Inputs Tab */}
      {activeTab === "inputs" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("review.changesInContext")}
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={4}
              value={changesInContext}
              onChange={(e) => setChangesInContext(e.target.value)}
              placeholder={t("review.changesInContextPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("review.performance")}
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={4}
              value={performanceFeedback}
              onChange={(e) => setPerformanceFeedback(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("review.auditResults")}
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={4}
              value={auditResults}
              onChange={(e) => setAuditResults(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("review.improvements")}
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={4}
              value={improvementOpportunities}
              onChange={(e) => setImprovementOpportunities(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Decisions Tab */}
      {activeTab === "decisions" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          {decisions.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-sm font-mono text-gray-400 shrink-0">
                {i + 1}.
              </span>
              <input
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={d.text}
                onChange={(e) => {
                  const next = [...decisions];
                  next[i] = { ...d, text: e.target.value };
                  setDecisions(next);
                }}
              />
              <button
                onClick={() =>
                  setDecisions(decisions.filter((_, j) => j !== i))
                }
                className="text-red-400 hover:text-red-600 text-sm"
              >
                x
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addDecision}>
            {t("review.addDecision")}
          </Button>
        </div>
      )}

      {/* Actions Tab */}
      {activeTab === "actions" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          {actionItems.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              {t("review.noActions")}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-600">
                    {t("review.actionTitle")}
                  </th>
                  <th className="text-left py-2 font-medium text-gray-600">
                    {t("review.responsible")}
                  </th>
                  <th className="text-left py-2 font-medium text-gray-600">
                    {t("review.dueDate")}
                  </th>
                  <th className="text-left py-2 font-medium text-gray-600">
                    {t("review.actionStatus")}
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {actionItems.map((a, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-2">
                      <input
                        className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                        value={a.title}
                        onChange={(e) => {
                          const next = [...actionItems];
                          next[i] = { ...a, title: e.target.value };
                          setActionItems(next);
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                        value={a.responsible}
                        onChange={(e) => {
                          const next = [...actionItems];
                          next[i] = { ...a, responsible: e.target.value };
                          setActionItems(next);
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="date"
                        className="rounded border border-gray-200 px-2 py-1 text-sm"
                        value={a.dueDate}
                        onChange={(e) => {
                          const next = [...actionItems];
                          next[i] = { ...a, dueDate: e.target.value };
                          setActionItems(next);
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        className="rounded border border-gray-200 px-2 py-1 text-sm"
                        value={a.status}
                        onChange={(e) => {
                          const next = [...actionItems];
                          next[i] = { ...a, status: e.target.value };
                          setActionItems(next);
                        }}
                      >
                        <option value="open">
                          {t("review.actionStatuses.open")}
                        </option>
                        <option value="in_progress">
                          {t("review.actionStatuses.in_progress")}
                        </option>
                        <option value="completed">
                          {t("review.actionStatuses.completed")}
                        </option>
                      </select>
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() =>
                          setActionItems(actionItems.filter((_, j) => j !== i))
                        }
                        className="text-red-400 hover:text-red-600 text-sm"
                      >
                        x
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Button variant="outline" size="sm" onClick={addAction}>
            {t("review.addAction")}
          </Button>
        </div>
      )}

      {/* Minutes Tab */}
      {activeTab === "minutes" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("review.minutesLabel")}
          </label>
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            rows={15}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder={t("review.minutesPlaceholder")}
          />
        </div>
      )}
    </div>
  );
}
