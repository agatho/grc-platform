"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Loader2, ClipboardCheck } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AssessmentRun, AssessmentStatus } from "@grc/shared";

const STATUS_COLORS: Record<AssessmentStatus, string> = {
  planning: "bg-gray-100 text-gray-700 border-gray-300",
  in_progress: "bg-blue-100 text-blue-900 border-blue-300",
  review: "bg-yellow-100 text-yellow-900 border-yellow-300",
  completed: "bg-green-100 text-green-900 border-green-300",
  cancelled: "bg-red-100 text-red-900 border-red-300",
};

export default function AssessmentListPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ModuleTabNav />
      <AssessmentListInner />
    </ModuleGate>
  );
}

function AssessmentListInner() {
  const t = useTranslations("ismsAssessment");
  const router = useRouter();
  const [assessments, setAssessments] = useState<AssessmentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/isms/assessments?limit=50");
      if (res.ok) {
        const json = await res.json();
        setAssessments(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAssessments();
  }, [fetchAssessments]);

  const handleCreate = async (formData: {
    name: string;
    description: string;
    scopeType: string;
    framework: string;
    periodStart: string;
    periodEnd: string;
  }) => {
    const res = await fetch("/api/v1/isms/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      setShowCreate(false);
      void fetchAssessments();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("assessment.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("assessment.subtitle")}
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} className="mr-1" /> {t("assessment.create")}
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <CreateAssessmentForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          t={t}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : assessments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p>{t("assessment.empty")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => (
            <Link
              key={a.id}
              href={`/isms/assessments/${a.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm hover:border-blue-200 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {a.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[a.status]}
                    >
                      {t(`assessment.statuses.${a.status}`)}
                    </Badge>
                  </div>
                  {a.description && (
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {a.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>{a.framework}</span>
                    {a.periodStart && a.periodEnd && (
                      <span>
                        {a.periodStart} - {a.periodEnd}
                      </span>
                    )}
                    <span>
                      {a.completedEvaluations}/{a.totalEvaluations}{" "}
                      {t("evaluation.evaluated")}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 ml-4 w-24">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${a.completionPercentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    {a.completionPercentage}%
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateAssessmentForm({
  onSubmit,
  onCancel,
  t,
}: {
  onSubmit: (data: {
    name: string;
    description: string;
    scopeType: string;
    framework: string;
    periodStart: string;
    periodEnd: string;
  }) => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scopeType, setScopeType] = useState("full");
  const [framework, setFramework] = useState("iso27001");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">
        {t("assessment.create")}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t("assessment.name")}
          </label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("assessment.namePlaceholder")}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t("assessment.framework")}
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
          >
            <option value="iso27001">ISO 27001:2022</option>
            <option value="bsi_grundschutz">BSI Grundschutz</option>
            <option value="nis2">NIS2</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t("assessment.scopeType")}
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value)}
          >
            <option value="full">{t("assessment.scope.full")}</option>
            <option value="department">
              {t("assessment.scope.department")}
            </option>
            <option value="asset_group">
              {t("assessment.scope.assetGroup")}
            </option>
            <option value="custom">{t("assessment.scope.custom")}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t("assessment.description")}
          </label>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t("assessment.periodStart")}
          </label>
          <input
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            {t("assessment.periodEnd")}
          </label>
          <input
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t("actions.cancel")}
        </Button>
        <Button
          size="sm"
          onClick={() =>
            onSubmit({
              name,
              description,
              scopeType,
              framework,
              periodStart,
              periodEnd,
            })
          }
          disabled={!name || !periodStart || !periodEnd}
        >
          {t("assessment.create")}
        </Button>
      </div>
    </div>
  );
}
