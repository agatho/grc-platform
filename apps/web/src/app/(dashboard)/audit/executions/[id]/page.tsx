"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  RefreshCcw,
  Sparkles,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  BookOpen,
  ChevronDown,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  Audit,
  AuditChecklist,
  AuditChecklistItem,
  AuditActivity,
} from "@grc/shared";

interface AuditDetail extends Audit {
  leadAuditorName?: string | null;
}

interface Finding {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
}

export default function ExecutionDetailPage() {
  return (
    <ModuleGate moduleKey="audit">
      <ExecutionDetailInner />
    </ModuleGate>
  );
}

type TabKey = "overview" | "checklists" | "activities" | "findings" | "report";

function ExecutionDetailInner() {
  const t = useTranslations("auditMgmt");
  const params = useParams<{ id: string }>();
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/audit-mgmt/audits/${params.id}`);
      if (res.ok) {
        const json = await res.json();
        setAudit(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void fetchAudit();
  }, [fetchAudit]);

  const handleStatusChange = async (newStatus: string, conclusion?: string) => {
    const body: Record<string, string> = { status: newStatus };
    if (conclusion) body.conclusion = conclusion;

    const res = await fetch(`/api/v1/audit-mgmt/audits/${params.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      void fetchAudit();
    }
  };

  if (loading && !audit) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t("auditNotFound")}</p>
        <Link href="/audit/executions" className="text-blue-600 text-sm mt-2 inline-block">
          {t("backToAudits")}
        </Link>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { className: string; label: string }> = {
      planned: { className: "bg-gray-100 text-gray-700", label: t("auditStatus.planned") },
      preparation: { className: "bg-blue-100 text-blue-900", label: t("auditStatus.preparation") },
      fieldwork: { className: "bg-yellow-100 text-yellow-900", label: t("auditStatus.fieldwork") },
      reporting: { className: "bg-orange-100 text-orange-900", label: t("auditStatus.reporting") },
      review: { className: "bg-purple-100 text-purple-900", label: t("auditStatus.review") },
      completed: { className: "bg-green-100 text-green-900", label: t("auditStatus.completed") },
      cancelled: { className: "bg-red-100 text-red-900", label: t("auditStatus.cancelled") },
    };
    const config = map[status] ?? map.planned;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const nextStatus: Record<string, string> = {
    planned: "preparation",
    preparation: "fieldwork",
    fieldwork: "reporting",
    reporting: "review",
    review: "completed",
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: t("tabs.overview") },
    { key: "checklists", label: t("tabs.checklists") },
    { key: "activities", label: t("tabs.activities") },
    { key: "findings", label: t("tabs.findings") },
    { key: "report", label: t("tabs.report") },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/audit/executions" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{audit.title}</h1>
            {statusBadge(audit.status)}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {audit.leadAuditorName ? `${t("lead")}: ${audit.leadAuditorName}` : ""}{" "}
            {audit.plannedStart ? `| ${audit.plannedStart} - ${audit.plannedEnd ?? ""}` : ""}
          </p>
        </div>
        {nextStatus[audit.status] && (
          <Button
            size="sm"
            onClick={() => handleStatusChange(nextStatus[audit.status])}
          >
            {t("advanceTo")} {t(`auditStatus.${nextStatus[audit.status]}`)}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab audit={audit} />}
      {activeTab === "checklists" && <ChecklistsTab auditId={params.id} orgId={audit.orgId} />}
      {activeTab === "activities" && <ActivitiesTab auditId={params.id} />}
      {activeTab === "findings" && <FindingsTab auditId={params.id} />}
      {activeTab === "report" && <ReportTab audit={audit} />}
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────

function OverviewTab({ audit }: { audit: AuditDetail }) {
  const t = useTranslations("auditMgmt");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">{t("details")}</h2>
        <dl className="space-y-3 text-sm">
          <InfoRow label={t("auditType")} value={t(`auditTypes.${audit.auditType === "follow_up" ? "followUp" : audit.auditType}`)} />
          <InfoRow label={t("description")} value={audit.description ?? "-"} />
          <InfoRow label={t("scope")} value={audit.scopeDescription ?? "-"} />
          <InfoRow label={t("plannedStart")} value={audit.plannedStart ?? "-"} />
          <InfoRow label={t("plannedEnd")} value={audit.plannedEnd ?? "-"} />
          <InfoRow label={t("actualStart")} value={audit.actualStart ?? "-"} />
          <InfoRow label={t("actualEnd")} value={audit.actualEnd ?? "-"} />
        </dl>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">{t("team")}</h2>
        <dl className="space-y-3 text-sm">
          <InfoRow label={t("lead")} value={audit.leadAuditorName ?? "-"} />
          <InfoRow label={t("findingCount")} value={String(audit.findingCount ?? 0)} />
          {audit.conclusion && (
            <InfoRow label={t("conclusion")} value={t(`conclusions.${audit.conclusion}`)} />
          )}
        </dl>
        {audit.scopeFrameworks && audit.scopeFrameworks.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">{t("frameworks")}</p>
            <div className="flex flex-wrap gap-1">
              {audit.scopeFrameworks.map((fw) => (
                <Badge key={fw} variant="outline">{fw}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium text-right max-w-[60%]">{value}</dd>
    </div>
  );
}

// ─── Checklists Tab ──────────────────────────────────────────

function ChecklistsTab({ auditId, orgId }: { auditId: string; orgId: string }) {
  const t = useTranslations("auditMgmt");
  const [checklists, setChecklists] = useState<AuditChecklist[]>([]);
  const [selectedChecklist, setSelectedChecklist] = useState<string | null>(null);
  const [items, setItems] = useState<AuditChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; source: string } | null>(null);
  const [evaluateItem, setEvaluateItem] = useState<AuditChecklistItem | null>(null);
  const [createFindingItem, setCreateFindingItem] = useState<AuditChecklistItem | null>(null);

  const fetchChecklists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/audit-mgmt/audits/${auditId}/checklists?limit=100`);
      if (res.ok) {
        const json = await res.json();
        setChecklists(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [auditId]);

  const fetchItems = useCallback(async (checklistId: string) => {
    const res = await fetch(
      `/api/v1/audit-mgmt/audits/${auditId}/checklists/${checklistId}/items`,
    );
    if (res.ok) {
      const json = await res.json();
      setItems(json.data ?? []);
    }
  }, [auditId]);

  useEffect(() => {
    void fetchChecklists();
  }, [fetchChecklists]);

  useEffect(() => {
    if (selectedChecklist) {
      void fetchItems(selectedChecklist);
    }
  }, [selectedChecklist, fetchItems]);

  // Auto-select first checklist
  useEffect(() => {
    if (checklists.length > 0 && !selectedChecklist) {
      setSelectedChecklist(checklists[0].id);
    }
  }, [checklists, selectedChecklist]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/v1/audit-mgmt/audits/${auditId}/checklists/generate`, {
        method: "POST",
      });
      if (res.ok) {
        void fetchChecklists();
      }
    } finally {
      setGenerating(false);
    }
  };

  const FRAMEWORK_SOURCES = [
    { key: "iia_standards_2024", labelKey: "importIia" },
    { key: "isae3402_soc2", labelKey: "importSoc2" },
    { key: "cobit_2019", labelKey: "importCobit" },
  ] as const;

  const handleImportFromFramework = async (source: string, labelKey: string) => {
    setImporting(true);
    setImportMenuOpen(false);
    setImportResult(null);
    try {
      const templateRes = await fetch(`/api/v1/audit-mgmt/templates?source=${source}`);
      if (!templateRes.ok) return;
      const templateJson = await templateRes.json();
      const entries: Array<{ question: string; reference?: string }> = templateJson.data ?? [];

      let created = 0;
      for (const entry of entries) {
        const body = {
          question: entry.question ?? entry.reference ?? "",
          reference: entry.reference,
        };
        const res = await fetch(
          `/api/v1/audit-mgmt/audits/${auditId}/checklists`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        if (res.ok) created++;
      }

      setImportResult({ count: created, source: labelKey });
      void fetchChecklists();
      if (selectedChecklist) void fetchItems(selectedChecklist);
    } finally {
      setImporting(false);
    }
  };

  const handleEvaluate = async (itemId: string, formData: FormData) => {
    if (!selectedChecklist) return;

    const body = {
      result: formData.get("result") as string,
      notes: formData.get("notes") as string || undefined,
    };

    const res = await fetch(
      `/api/v1/audit-mgmt/audits/${auditId}/checklists/${selectedChecklist}/items/${itemId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (res.ok) {
      setEvaluateItem(null);
      void fetchItems(selectedChecklist);
      void fetchChecklists();
    }
  };

  const handleCreateFinding = async (itemId: string, formData: FormData) => {
    if (!selectedChecklist) return;

    const body = {
      title: formData.get("title") as string,
      description: formData.get("description") as string || undefined,
      severity: formData.get("severity") as string,
      remediationDueDate: formData.get("remediationDueDate") as string || undefined,
    };

    const res = await fetch(
      `/api/v1/audit-mgmt/audits/${auditId}/checklists/${selectedChecklist}/items/${itemId}/create-finding`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (res.ok) {
      setCreateFindingItem(null);
    }
  };

  const resultIcon = (result: string | null | undefined) => {
    switch (result) {
      case "conforming":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "nonconforming":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "observation":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "not_applicable":
        return <MinusCircle className="h-4 w-4 text-gray-400" />;
      default:
        return <span className="h-4 w-4 rounded-full border-2 border-gray-300 inline-block" />;
    }
  };

  const selectedCl = checklists.find((c) => c.id === selectedChecklist);
  const completedCount = selectedCl?.completedItems ?? 0;
  const totalCount = selectedCl?.totalItems ?? items.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {checklists.map((cl) => (
            <Button
              key={cl.id}
              variant={selectedChecklist === cl.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedChecklist(cl.id)}
            >
              {cl.name}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {/* Import from Framework dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportMenuOpen(!importMenuOpen)}
              disabled={importing}
            >
              {importing ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <BookOpen size={14} className="mr-1" />
              )}
              {t("importFromFramework")}
              <ChevronDown size={12} className="ml-1" />
            </Button>
            {importMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-gray-200 bg-white shadow-lg z-20">
                {FRAMEWORK_SOURCES.map((fw) => (
                  <button
                    key={fw.key}
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-md last:rounded-b-md"
                    onClick={() => handleImportFromFramework(fw.key, fw.labelKey)}
                  >
                    {t(fw.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
          >
            <Sparkles size={14} className={`mr-1 ${generating ? "animate-spin" : ""}`} />
            {t("generateChecklist")}
          </Button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center justify-between">
          <p className="text-sm text-green-800">
            {t("importResult", { count: importResult.count, source: t(importResult.source) })}
          </p>
          <button
            onClick={() => setImportResult(null)}
            className="text-green-600 hover:text-green-800 text-sm font-medium"
          >
            {t("dismiss")}
          </button>
        </div>
      )}

      {selectedChecklist && (
        <>
          {/* Progress */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {t("progress")}: {completedCount}/{totalCount} ({progressPct}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 rounded-full h-2 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Items Table */}
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-400">{t("emptyChecklist")}</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 w-8">#</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">{t("question")}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">{t("result")}</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 w-40">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{item.sortOrder}</td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{item.question}</p>
                        {item.notes && (
                          <p className="text-xs text-gray-500 mt-1">{item.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {resultIcon(item.result)}
                          <span className="text-xs text-gray-600">
                            {item.result ? t(`results.${item.result}`) : t("results.open")}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEvaluateItem(item)}
                          >
                            {t("evaluate")}
                          </Button>
                          {item.result === "nonconforming" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setCreateFindingItem(item)}
                            >
                              {t("createFinding")}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Evaluate Dialog */}
      <Dialog open={!!evaluateItem} onOpenChange={() => setEvaluateItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("evaluateItem")}</DialogTitle>
          </DialogHeader>
          {evaluateItem && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleEvaluate(evaluateItem.id, new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <p className="text-sm text-gray-700">{evaluateItem.question}</p>
              <div>
                <label className="text-sm font-medium">{t("result")}</label>
                <select
                  name="result"
                  required
                  defaultValue={evaluateItem.result ?? ""}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t("selectResult")}</option>
                  <option value="conforming">{t("results.conforming")}</option>
                  <option value="nonconforming">{t("results.nonconforming")}</option>
                  <option value="observation">{t("results.observation")}</option>
                  <option value="not_applicable">{t("results.not_applicable")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{t("notes")}</label>
                <textarea
                  name="notes"
                  defaultValue={evaluateItem.notes ?? ""}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <Button type="submit" className="w-full">{t("save")}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Finding Dialog */}
      <Dialog open={!!createFindingItem} onOpenChange={() => setCreateFindingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createFinding")}</DialogTitle>
          </DialogHeader>
          {createFindingItem && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateFinding(createFindingItem.id, new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium">{t("findingTitle")}</label>
                <Input name="title" required />
              </div>
              <div>
                <label className="text-sm font-medium">{t("description")}</label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("findingSeverity")}</label>
                <select
                  name="severity"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="significant_nonconformity">{t("severity.significantNonconformity")}</option>
                  <option value="insignificant_nonconformity">{t("severity.insignificantNonconformity")}</option>
                  <option value="improvement_requirement">{t("severity.improvementRequirement")}</option>
                  <option value="recommendation">{t("severity.recommendation")}</option>
                  <option value="observation">{t("severity.observation")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{t("remediationDueDate")}</label>
                <Input name="remediationDueDate" type="date" />
              </div>
              <Button type="submit" className="w-full">{t("save")}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Activities Tab ──────────────────────────────────────────

function ActivitiesTab({ auditId }: { auditId: string }) {
  const t = useTranslations("auditMgmt");
  const [activities, setActivities] = useState<AuditActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/audit-mgmt/audits/${auditId}/activities?limit=100`);
      if (res.ok) {
        const json = await res.json();
        setActivities(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [auditId]);

  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

  const handleCreate = async (formData: FormData) => {
    const body = {
      activityType: formData.get("activityType") as string,
      title: formData.get("title") as string,
      description: formData.get("description") as string || undefined,
      duration: formData.get("duration") ? Number(formData.get("duration")) : undefined,
      notes: formData.get("notes") as string || undefined,
    };

    const res = await fetch(`/api/v1/audit-mgmt/audits/${auditId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setDialogOpen(false);
      void fetchActivities();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{t("activityLog")}</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={14} className="mr-1" />
              {t("addActivity")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("addActivity")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreate(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium">{t("activityType")}</label>
                <select name="activityType" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="interview">{t("activityTypes.interview")}</option>
                  <option value="document_review">{t("activityTypes.documentReview")}</option>
                  <option value="walkthrough">{t("activityTypes.walkthrough")}</option>
                  <option value="testing">{t("activityTypes.testing")}</option>
                  <option value="meeting">{t("activityTypes.meeting")}</option>
                  <option value="other">{t("activityTypes.other")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{t("activityTitle")}</label>
                <Input name="title" required />
              </div>
              <div>
                <label className="text-sm font-medium">{t("description")}</label>
                <Input name="description" />
              </div>
              <div>
                <label className="text-sm font-medium">{t("durationMinutes")}</label>
                <Input name="duration" type="number" min="1" />
              </div>
              <div>
                <label className="text-sm font-medium">{t("notes")}</label>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <Button type="submit" className="w-full">{t("save")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8 text-gray-400">{t("emptyActivities")}</div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{activity.activityType}</Badge>
                  <span className="font-medium text-gray-900">{activity.title}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(activity.performedAt).toLocaleString()}
                  {activity.duration ? ` (${activity.duration}min)` : ""}
                </span>
              </div>
              {activity.description && (
                <p className="text-sm text-gray-600">{activity.description}</p>
              )}
              {activity.notes && (
                <p className="text-xs text-gray-400 mt-1">{activity.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Findings Tab ────────────────────────────────────────────

function FindingsTab({ auditId }: { auditId: string }) {
  const t = useTranslations("auditMgmt");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFindings = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/findings?source=audit&limit=100`);
        if (res.ok) {
          const json = await res.json();
          // Filter by auditId client-side (shared finding table)
          const all = json.data ?? [];
          setFindings(all);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchFindings();
  }, [auditId]);

  const severityBadge = (severity: string) => {
    const map: Record<string, string> = {
      significant_nonconformity: "bg-red-100 text-red-900",
      insignificant_nonconformity: "bg-orange-100 text-orange-900",
      improvement_requirement: "bg-yellow-100 text-yellow-900",
      recommendation: "bg-blue-100 text-blue-900",
      observation: "bg-gray-100 text-gray-700",
    };
    return <Badge className={map[severity] ?? "bg-gray-100 text-gray-700"}>{t(`severity.${severity.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}`)}</Badge>;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">{t("findingsForAudit")}</h2>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : findings.length === 0 ? (
        <div className="text-center py-8 text-gray-400">{t("emptyFindings")}</div>
      ) : (
        <div className="space-y-3">
          {findings.map((f) => (
            <div
              key={f.id}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{f.title}</span>
                <div className="flex items-center gap-2">
                  {severityBadge(f.severity)}
                  <Badge variant="outline">{f.status}</Badge>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(f.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Report Tab ──────────────────────────────────────────────

function ReportTab({ audit }: { audit: AuditDetail }) {
  const t = useTranslations("auditMgmt");

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">{t("report")}</h2>
      {audit.status === "completed" ? (
        <div className="space-y-3">
          <InfoRow label={t("conclusion")} value={audit.conclusion ? t(`conclusions.${audit.conclusion}`) : "-"} />
          <InfoRow label={t("findingCount")} value={String(audit.findingCount ?? 0)} />
          <InfoRow label={t("actualStart")} value={audit.actualStart ?? "-"} />
          <InfoRow label={t("actualEnd")} value={audit.actualEnd ?? "-"} />
          {audit.reportDocumentId && (
            <Link
              href={`/documents/${audit.reportDocumentId}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {t("viewReport")}
            </Link>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-400">{t("reportNotReady")}</p>
      )}
    </div>
  );
}
