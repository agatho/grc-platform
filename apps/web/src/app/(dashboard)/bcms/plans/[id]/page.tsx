"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Plus, Trash2 } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Bcp, BcpProcedure, BcpResource } from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_review: "bg-yellow-100 text-yellow-900",
  approved: "bg-blue-100 text-blue-900",
  published: "bg-green-100 text-green-900",
  archived: "bg-gray-50 text-gray-400",
  superseded: "bg-orange-100 text-orange-900",
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  people: "People",
  it_system: "IT",
  facility: "Facility",
  supplier: "Supplier",
  equipment: "Equipment",
  data: "Data",
  other: "Other",
};

export default function BcpDetailPage() {
  return (
    <ModuleGate moduleKey="bcms">
      <BcpDetailInner />
    </ModuleGate>
  );
}

function BcpDetailInner() {
  const t = useTranslations("bcms");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [plan, setPlan] = useState<Bcp | null>(null);
  const [procedures, setProcedures] = useState<BcpProcedure[]>([]);
  const [resources, setResources] = useState<BcpResource[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "procedures" | "resources" | "activation">("overview");
  const [loading, setLoading] = useState(true);

  // Procedure form
  const [showAddStep, setShowAddStep] = useState(false);
  const [stepTitle, setStepTitle] = useState("");
  const [stepDesc, setStepDesc] = useState("");
  const [stepDuration, setStepDuration] = useState<number | undefined>();
  const [addingStep, setAddingStep] = useState(false);

  // Resource form
  const [showAddResource, setShowAddResource] = useState(false);
  const [resName, setResName] = useState("");
  const [resType, setResType] = useState("people");
  const [addingResource, setAddingResource] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, procRes, rRes] = await Promise.all([
        fetch(`/api/v1/bcms/plans/${id}`),
        fetch(`/api/v1/bcms/plans/${id}/procedures?limit=100`),
        fetch(`/api/v1/bcms/plans/${id}/resources?limit=100`),
      ]);
      if (pRes.ok) { const j = await pRes.json(); setPlan(j.data); }
      if (procRes.ok) { const j = await procRes.json(); setProcedures(j.data ?? []); }
      if (rRes.ok) { const j = await rRes.json(); setResources(j.data ?? []); }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleAddStep = async () => {
    if (!stepTitle.trim()) return;
    setAddingStep(true);
    try {
      const res = await fetch(`/api/v1/bcms/plans/${id}/procedures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepNumber: procedures.length + 1,
          title: stepTitle,
          description: stepDesc || undefined,
          estimatedDurationMinutes: stepDuration,
        }),
      });
      if (res.ok) {
        setStepTitle("");
        setStepDesc("");
        setStepDuration(undefined);
        setShowAddStep(false);
        void fetchData();
      }
    } finally {
      setAddingStep(false);
    }
  };

  const handleAddResource = async () => {
    if (!resName.trim()) return;
    setAddingResource(true);
    try {
      const res = await fetch(`/api/v1/bcms/plans/${id}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: resName, resourceType: resType }),
      });
      if (res.ok) {
        setResName("");
        setResType("people");
        setShowAddResource(false);
        void fetchData();
      }
    } finally {
      setAddingResource(false);
    }
  };

  const handleDeleteProcedure = async (procId: string) => {
    await fetch(`/api/v1/bcms/plans/${id}/procedures/${procId}`, { method: "DELETE" });
    void fetchData();
  };

  if (loading && !plan) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!plan) {
    return <p className="text-center text-gray-400 py-12">{t("bcp.notFound")}</p>;
  }

  const totalDuration = procedures.reduce((sum, p) => sum + (p.estimatedDurationMinutes ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/bcms/plans")} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{plan.title}</h1>
            <p className="text-sm text-gray-500">
              {t("bcp.version")}: {plan.version}
              {plan.lastTestedDate && ` | ${t("bcp.lastTested")}: ${plan.lastTestedDate}`}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={STATUS_COLORS[plan.status]}>
          {t(`bcp.status.${plan.status}`)}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["overview", "procedures", "resources", "activation"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t(`bcp.${tab === "overview" ? "overview" : tab === "procedures" ? "procedures" : tab === "resources" ? "resources" : "activation"}`)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500">{t("common.description")}</dt>
                <dd className="text-sm text-gray-900 mt-1">{plan.description || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">{t("bcp.scope")}</dt>
                <dd className="text-sm text-gray-900 mt-1">{plan.scope || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">{t("bcp.totalDuration")}</dt>
                <dd className="text-sm text-gray-900 mt-1">{totalDuration} {t("bcp.minutes")} ({Math.round(totalDuration / 60 * 10) / 10}h)</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">{t("bcp.procedures")}</dt>
                <dd className="text-sm text-gray-900 mt-1">{procedures.length} {t("bcp.step")}(s)</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Procedures Tab */}
      {activeTab === "procedures" && (
        <div className="space-y-4">
          {procedures.length === 0 ? (
            <p className="text-center text-gray-400 py-8">{t("common.noData")}</p>
          ) : (
            <div className="space-y-3">
              {procedures.map((proc) => (
                <div key={proc.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-900 font-bold text-sm shrink-0">
                        {proc.stepNumber}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{proc.title}</p>
                        {proc.description && <p className="text-sm text-gray-500 mt-1">{proc.description}</p>}
                        <div className="flex gap-4 mt-2 text-xs text-gray-400">
                          {proc.responsibleRole && <span>{t("bcp.responsible")}: {proc.responsibleRole}</span>}
                          {proc.estimatedDurationMinutes && <span>~{proc.estimatedDurationMinutes} {t("bcp.minutes")}</span>}
                        </div>
                        {proc.prerequisites && (
                          <p className="text-xs text-gray-400 mt-1">{t("bcp.prerequisites")}: {proc.prerequisites}</p>
                        )}
                        {proc.successCriteria && (
                          <p className="text-xs text-gray-400 mt-1">{t("bcp.successCriteria")}: {proc.successCriteria}</p>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteProcedure(proc.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Duration summary */}
          {procedures.length > 0 && (
            <div className="text-sm text-gray-600">
              {t("bcp.totalDuration")}: ~{totalDuration} {t("bcp.minutes")} ({Math.round(totalDuration / 60 * 10) / 10}h)
            </div>
          )}

          {/* Add step */}
          {showAddStep ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
              <input
                type="text"
                value={stepTitle}
                onChange={(e) => setStepTitle(e.target.value)}
                placeholder={t("common.name")}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <textarea
                value={stepDesc}
                onChange={(e) => setStepDesc(e.target.value)}
                placeholder={t("common.description")}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={2}
              />
              <input
                type="number"
                value={stepDuration ?? ""}
                onChange={(e) => setStepDuration(e.target.value ? Number(e.target.value) : undefined)}
                placeholder={`${t("bcp.duration")} (${t("bcp.minutes")})`}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handleAddStep} disabled={addingStep} size="sm">
                  {addingStep ? <Loader2 size={14} className="animate-spin" /> : t("common.save")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddStep(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddStep(true)}>
              <Plus size={14} className="mr-1" /> {t("bcp.addStep")}
            </Button>
          )}
        </div>
      )}

      {/* Resources Tab */}
      {activeTab === "resources" && (
        <div className="space-y-4">
          {resources.length === 0 ? (
            <p className="text-center text-gray-400 py-8">{t("common.noData")}</p>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t("common.name")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t("bcp.resource.quantity")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t("bcp.resource.offsite")}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">{t("bcp.resource.alternativeResource")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resources.map((res) => (
                    <tr key={res.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{res.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px]">
                          {RESOURCE_TYPE_LABELS[res.resourceType] ?? res.resourceType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{res.quantity}</td>
                      <td className="px-4 py-3 text-gray-600">{res.isAvailableOffsite ? "Yes" : "No"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{res.alternativeResource ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showAddResource ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
              <input
                type="text"
                value={resName}
                onChange={(e) => setResName(e.target.value)}
                placeholder={t("common.name")}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <select
                value={resType}
                onChange={(e) => setResType(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {Object.entries(RESOURCE_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button onClick={handleAddResource} disabled={addingResource} size="sm">
                  {addingResource ? <Loader2 size={14} className="animate-spin" /> : t("common.save")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddResource(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddResource(true)}>
              <Plus size={14} className="mr-1" /> {t("bcp.resource.addResource")}
            </Button>
          )}
        </div>
      )}

      {/* Activation Tab */}
      {activeTab === "activation" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <div>
            <dt className="text-xs font-medium text-gray-500">{t("bcp.activation")}</dt>
            <dd className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{plan.activationCriteria || "-"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">{t("bcp.activationAuthority")}</dt>
            <dd className="text-sm text-gray-900 mt-1">{plan.activationAuthority || "-"}</dd>
          </div>
        </div>
      )}
    </div>
  );
}
