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
        <Link
          href="/audit/executions"
          className="text-blue-600 text-sm mt-2 inline-block"
        >
          {t("backToAudits")}
        </Link>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { className: string; label: string }> = {
      planned: {
        className: "bg-gray-100 text-gray-700",
        label: t("auditStatus.planned"),
      },
      preparation: {
        className: "bg-blue-100 text-blue-900",
        label: t("auditStatus.preparation"),
      },
      fieldwork: {
        className: "bg-yellow-100 text-yellow-900",
        label: t("auditStatus.fieldwork"),
      },
      reporting: {
        className: "bg-orange-100 text-orange-900",
        label: t("auditStatus.reporting"),
      },
      review: {
        className: "bg-purple-100 text-purple-900",
        label: t("auditStatus.review"),
      },
      completed: {
        className: "bg-green-100 text-green-900",
        label: t("auditStatus.completed"),
      },
      cancelled: {
        className: "bg-red-100 text-red-900",
        label: t("auditStatus.cancelled"),
      },
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
        <Link
          href="/audit/executions"
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{audit.title}</h1>
            {statusBadge(audit.status)}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {audit.leadAuditorName
              ? `${t("lead")}: ${audit.leadAuditorName}`
              : ""}{" "}
            {audit.plannedStart
              ? `| ${audit.plannedStart} - ${audit.plannedEnd ?? ""}`
              : ""}
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
      {activeTab === "checklists" && (
        <ChecklistsTab auditId={params.id} orgId={audit.orgId} />
      )}
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
        <h2 className="text-base font-semibold text-gray-900">
          {t("details")}
        </h2>
        <dl className="space-y-3 text-sm">
          <InfoRow
            label={t("auditType")}
            value={t(
              `auditTypes.${audit.auditType === "follow_up" ? "followUp" : audit.auditType}`,
            )}
          />
          <InfoRow label={t("description")} value={audit.description ?? "-"} />
          <InfoRow label={t("scope")} value={audit.scopeDescription ?? "-"} />
          <InfoRow
            label={t("plannedStart")}
            value={audit.plannedStart ?? "-"}
          />
          <InfoRow label={t("plannedEnd")} value={audit.plannedEnd ?? "-"} />
          <InfoRow label={t("actualStart")} value={audit.actualStart ?? "-"} />
          <InfoRow label={t("actualEnd")} value={audit.actualEnd ?? "-"} />
        </dl>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-900">{t("team")}</h2>
        <dl className="space-y-3 text-sm">
          <InfoRow label={t("lead")} value={audit.leadAuditorName ?? "-"} />
          <InfoRow
            label={t("findingCount")}
            value={String(audit.findingCount ?? 0)}
          />
          {audit.conclusion && (
            <InfoRow
              label={t("conclusion")}
              value={t(`conclusions.${audit.conclusion}`)}
            />
          )}
        </dl>
        {audit.scopeFrameworks && audit.scopeFrameworks.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">
              {t("frameworks")}
            </p>
            <div className="flex flex-wrap gap-1">
              {audit.scopeFrameworks.map((fw) => (
                <Badge key={fw} variant="outline">
                  {fw}
                </Badge>
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
      <dd className="text-gray-900 font-medium text-right max-w-[60%]">
        {value}
      </dd>
    </div>
  );
}

// ─── Checklists Tab ──────────────────────────────────────────

function ChecklistsTab({ auditId, orgId }: { auditId: string; orgId: string }) {
  const t = useTranslations("auditMgmt");
  const [checklists, setChecklists] = useState<AuditChecklist[]>([]);
  const [selectedChecklist, setSelectedChecklist] = useState<string | null>(
    null,
  );
  const [items, setItems] = useState<AuditChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importResult, setImportResult] = useState<{
    count: number;
    source: string;
  } | null>(null);
  const [evaluateItem, setEvaluateItem] = useState<AuditChecklistItem | null>(
    null,
  );
  const [createFindingItem, setCreateFindingItem] =
    useState<AuditChecklistItem | null>(null);
  const [risks, setRisks] = useState<
    Array<{ id: string; title: string; riskCategory?: string | null }>
  >([]);
  const [activeCatalogs, setActiveCatalogs] = useState<
    Array<{
      catalogId: string;
      name: string;
      source: string | null;
      version: string | null;
    }>
  >([]);

  // Fetch risks for the risk-picker in the create-finding dialog + active
  // control catalogs for the framework-import dropdown (F-13: previously
  // hardcoded to IIA/SOC2/COBIT, now dynamic).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/v1/risks?limit=200");
        if (r.ok) {
          const j = await r.json();
          if (!cancelled) {
            setRisks(
              (j.data ?? []).map(
                (x: {
                  id: string;
                  title: string;
                  riskCategory?: string | null;
                }) => ({
                  id: x.id,
                  title: x.title,
                  riskCategory: x.riskCategory,
                }),
              ),
            );
          }
        }
      } catch {
        // ignore preload errors — UI falls back to empty lists
      }
      // Active control catalogs of the current org
      try {
        const ac = await fetch(
          `/api/v1/organizations/${orgId}/active-catalogs?catalogType=control`,
        );
        if (ac.ok) {
          const aj = await ac.json();
          // Enrich with catalog name via separate fetch on /api/v1/catalogs
          const ids: string[] = (aj.data ?? []).map(
            (x: { catalogId: string }) => x.catalogId,
          );
          if (ids.length > 0) {
            const catRes = await fetch(
              "/api/v1/catalogs?type=control&limit=200",
            );
            if (catRes.ok) {
              const catJ = await catRes.json();
              const byId = new Map(
                (catJ.data ?? []).map(
                  (c: {
                    id: string;
                    name: string;
                    source: string | null;
                    version: string | null;
                  }) => [c.id, c],
                ),
              );
              if (!cancelled) {
                setActiveCatalogs(
                  ids
                    .map((id) => byId.get(id))
                    .filter(
                      (
                        x,
                      ): x is {
                        id: string;
                        name: string;
                        source: string | null;
                        version: string | null;
                      } => !!x,
                    )
                    .map((c) => ({
                      catalogId: c.id,
                      name: c.name,
                      source: c.source,
                      version: c.version,
                    })),
                );
              }
            }
          }
        }
      } catch {
        // ignore preload errors — UI falls back to empty lists
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const fetchChecklists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/audit-mgmt/audits/${auditId}/checklists?limit=100`,
      );
      if (res.ok) {
        const json = await res.json();
        setChecklists(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [auditId]);

  const fetchItems = useCallback(
    async (checklistId: string) => {
      const res = await fetch(
        `/api/v1/audit-mgmt/audits/${auditId}/checklists/${checklistId}/items`,
      );
      if (res.ok) {
        const json = await res.json();
        setItems(json.data ?? []);
      }
    },
    [auditId],
  );

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

  const handleGenerate = async (catalogId?: string) => {
    setGenerating(true);
    setImportMenuOpen(false);
    try {
      const res = await fetch(
        `/api/v1/audit-mgmt/audits/${auditId}/checklists/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: catalogId ? JSON.stringify({ catalogId }) : "{}",
        },
      );
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

  const handleImportFromFramework = async (
    source: string,
    labelKey: string,
  ) => {
    setImporting(true);
    setImportMenuOpen(false);
    setImportResult(null);
    try {
      const templateRes = await fetch(
        `/api/v1/audit-mgmt/templates?source=${source}`,
      );
      if (!templateRes.ok) return;
      const templateJson = await templateRes.json();
      const entries: Array<{ question: string; reference?: string }> =
        templateJson.data ?? [];

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
      notes: (formData.get("notes") as string) || undefined,
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

    const riskIdRaw = formData.get("riskId") as string;
    const body: Record<string, unknown> = {
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      severity: formData.get("severity") as string,
      remediationDueDate:
        (formData.get("remediationDueDate") as string) || undefined,
    };
    // Closes the Audit → ERM feedback loop (ISO 27001 9.2 / IIA 2120): when
    // the auditor picks a concrete risk, the finding is persisted with
    // finding.riskId → every downstream aggregation (affectedRisks, KRI,
    // risk audit-impact) picks it up automatically.
    if (riskIdRaw) body.riskId = riskIdRaw;

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
        return (
          <span className="h-4 w-4 rounded-full border-2 border-gray-300 inline-block" />
        );
    }
  };

  const selectedCl = checklists.find((c) => c.id === selectedChecklist);
  const completedCount = selectedCl?.completedItems ?? 0;
  const totalCount = selectedCl?.totalItems ?? items.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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
              <div className="absolute right-0 top-full mt-1 w-72 rounded-md border border-gray-200 bg-white shadow-lg z-20 max-h-96 overflow-y-auto">
                {/* Audit-Framework-Templates (hardcoded, eigene API-Route) */}
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  Audit-Framework-Vorlagen
                </div>
                {FRAMEWORK_SOURCES.map((fw) => (
                  <button
                    key={fw.key}
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() =>
                      handleImportFromFramework(fw.key, fw.labelKey)
                    }
                  >
                    {t(fw.labelKey)}
                  </button>
                ))}

                {/* Dynamisch: aktive Kontroll-Kataloge der Org (F-13) */}
                {activeCatalogs.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-t border-b border-gray-100">
                      Aktive Kontroll-Kataloge
                    </div>
                    {activeCatalogs.map((cat) => (
                      <button
                        key={cat.catalogId}
                        type="button"
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => handleGenerate(cat.catalogId)}
                        title={
                          cat.source && cat.version
                            ? `${cat.source} ${cat.version}`
                            : undefined
                        }
                      >
                        {cat.name}
                        {cat.version && (
                          <span className="text-xs text-gray-400 ml-1">
                            · {cat.version}
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                )}
                {activeCatalogs.length === 0 && (
                  <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
                    Keine Kontroll-Kataloge aktiviert. Aktiviere z. B. ISO 27001
                    oder NIST CSF unter <em>/catalogs/controls</em>.
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleGenerate()}
            disabled={generating}
          >
            <Sparkles
              size={14}
              className={`mr-1 ${generating ? "animate-spin" : ""}`}
            />
            {t("generateChecklist")}
          </Button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center justify-between">
          <p className="text-sm text-green-800">
            {t("importResult", {
              count: importResult.count,
              source: t(importResult.source),
            })}
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
            <div className="text-center py-8 text-gray-400">
              {t("emptyChecklist")}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 w-8">
                      #
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                      {t("question")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">
                      {t("result")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 w-40">
                      {t("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">
                        {item.sortOrder}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{item.question}</p>
                        {item.notes && (
                          <p className="text-xs text-gray-500 mt-1">
                            {item.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {resultIcon(item.result)}
                          <span className="text-xs text-gray-600">
                            {item.result
                              ? t(`results.${item.result}`)
                              : t("results.open")}
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
                void handleEvaluate(
                  evaluateItem.id,
                  new FormData(e.currentTarget),
                );
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
                  <option value="nonconforming">
                    {t("results.nonconforming")}
                  </option>
                  <option value="observation">
                    {t("results.observation")}
                  </option>
                  <option value="not_applicable">
                    {t("results.not_applicable")}
                  </option>
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
              <Button type="submit" className="w-full">
                {t("save")}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Finding Dialog */}
      <Dialog
        open={!!createFindingItem}
        onOpenChange={() => setCreateFindingItem(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createFinding")}</DialogTitle>
          </DialogHeader>
          {createFindingItem && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateFinding(
                  createFindingItem.id,
                  new FormData(e.currentTarget),
                );
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium">
                  {t("findingTitle")}
                </label>
                <Input name="title" required />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t("description")}
                </label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t("findingSeverity")}
                </label>
                <select
                  name="severity"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="significant_nonconformity">
                    {t("severity.significantNonconformity")}
                  </option>
                  <option value="insignificant_nonconformity">
                    {t("severity.insignificantNonconformity")}
                  </option>
                  <option value="improvement_requirement">
                    {t("severity.improvementRequirement")}
                  </option>
                  <option value="recommendation">
                    {t("severity.recommendation")}
                  </option>
                  <option value="observation">
                    {t("severity.observation")}
                  </option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  Risiko-Verknüpfung
                  <span className="ml-1 text-xs text-gray-400">
                    (optional, ISO 27001 9.2 · ISO 31000 6.6)
                  </span>
                </label>
                <select
                  name="riskId"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="">— kein Risiko verknüpfen —</option>
                  {risks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                      {r.riskCategory ? ` (${r.riskCategory})` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Bei Verknüpfung wird die Feststellung als Wirksamkeitsnachweis
                  für das Risiko geführt — ein Maßnahmen-Plan kann per Sync als
                  Risk-Treatment übernommen werden.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t("remediationDueDate")}
                </label>
                <Input name="remediationDueDate" type="date" />
              </div>
              <Button type="submit" className="w-full">
                {t("save")}
              </Button>
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
      const res = await fetch(
        `/api/v1/audit-mgmt/audits/${auditId}/activities?limit=100`,
      );
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
      description: (formData.get("description") as string) || undefined,
      duration: formData.get("duration")
        ? Number(formData.get("duration"))
        : undefined,
      notes: (formData.get("notes") as string) || undefined,
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
        <h2 className="text-base font-semibold text-gray-900">
          {t("activityLog")}
        </h2>
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
                <label className="text-sm font-medium">
                  {t("activityType")}
                </label>
                <select
                  name="activityType"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="interview">
                    {t("activityTypes.interview")}
                  </option>
                  <option value="document_review">
                    {t("activityTypes.documentReview")}
                  </option>
                  <option value="walkthrough">
                    {t("activityTypes.walkthrough")}
                  </option>
                  <option value="testing">{t("activityTypes.testing")}</option>
                  <option value="meeting">{t("activityTypes.meeting")}</option>
                  <option value="other">{t("activityTypes.other")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t("activityTitle")}
                </label>
                <Input name="title" required />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t("description")}
                </label>
                <Input name="description" />
              </div>
              <div>
                <label className="text-sm font-medium">
                  {t("durationMinutes")}
                </label>
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
              <Button type="submit" className="w-full">
                {t("save")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          {t("emptyActivities")}
        </div>
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
                  <span className="font-medium text-gray-900">
                    {activity.title}
                  </span>
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
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [risks, setRisks] = useState<Array<{ id: string; title: string }>>([]);

  const fetchFindings = async () => {
    setLoading(true);
    try {
      // F-14: proper server-side filter (auditId was client-side filtered
      // before -> UI showed ALL org audit findings, misleading).
      const res = await fetch(`/api/v1/findings?auditId=${auditId}&limit=100`);
      if (res.ok) {
        const json = await res.json();
        setFindings(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchFindings();
    // Load risks for the optional risk-link picker
    (async () => {
      try {
        const r = await fetch("/api/v1/risks?limit=200");
        if (r.ok) {
          const j = await r.json();
          setRisks(
            (j.data ?? []).map((x: { id: string; title: string }) => ({
              id: x.id,
              title: x.title,
            })),
          );
        }
      } catch {
        // ignore preload errors — UI falls back to empty lists
      }
    })();
  }, [auditId]);

  const handleAdd = async (formData: FormData) => {
    setSaving(true);
    try {
      const riskIdRaw = formData.get("riskId") as string;
      const body: Record<string, unknown> = {
        title: formData.get("title") as string,
        description: (formData.get("description") as string) || undefined,
        severity: formData.get("severity") as string,
        source: "audit",
        auditId,
      };
      if (riskIdRaw) body.riskId = riskIdRaw;
      const remDue = formData.get("remediationDueDate") as string;
      if (remDue) body.remediationDueDate = remDue;

      const res = await fetch("/api/v1/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setAddOpen(false);
        await fetchFindings();
      }
    } finally {
      setSaving(false);
    }
  };

  const severityBadge = (severity: string) => {
    const map: Record<string, string> = {
      significant_nonconformity: "bg-red-100 text-red-900",
      insignificant_nonconformity: "bg-orange-100 text-orange-900",
      improvement_requirement: "bg-yellow-100 text-yellow-900",
      recommendation: "bg-blue-100 text-blue-900",
      observation: "bg-gray-100 text-gray-700",
    };
    return (
      <Badge className={map[severity] ?? "bg-gray-100 text-gray-700"}>
        {t(
          `severity.${severity.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}`,
        )}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">
          {t("findingsForAudit")}
        </h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={14} className="mr-1" />
              Feststellung hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Feststellung hinzufügen</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAdd(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium">Titel</label>
                <Input name="title" required />
              </div>
              <div>
                <label className="text-sm font-medium">Beschreibung</label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Schweregrad</label>
                <select
                  name="severity"
                  required
                  defaultValue="observation"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="significant_nonconformity">
                    Wesentliche Abweichung
                  </option>
                  <option value="insignificant_nonconformity">
                    Geringfügige Abweichung
                  </option>
                  <option value="improvement_requirement">
                    Verbesserungsanforderung
                  </option>
                  <option value="recommendation">Empfehlung</option>
                  <option value="observation">Beobachtung</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">
                  Risiko-Verknüpfung
                  <span className="ml-1 text-xs text-gray-400">
                    (optional, ISO 31000 6.6)
                  </span>
                </label>
                <select
                  name="riskId"
                  defaultValue=""
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">— kein Risiko verknüpfen —</option>
                  {risks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Fälligkeit</label>
                <Input name="remediationDueDate" type="date" />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : null}
                Speichern
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : findings.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>{t("emptyFindings")}</p>
          <p className="text-xs mt-2">
            Nutze „Feststellung hinzufügen" für Ad-hoc-Befunde oder erstelle aus
            einer nicht-konformen Checklisten-Position heraus.
          </p>
        </div>
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

interface ReportData {
  audit: AuditDetail & {
    leadAuditorEmail?: string | null;
    scopeProcesses?: string[] | null;
    scopeDepartments?: string[] | null;
    scopeFrameworks?: string[] | null;
  };
  checklists: Array<{
    id: string;
    name: string;
    sourceType: string | null;
    totalItems: number;
    completedItems: number;
  }>;
  breakdown: Array<{
    checklistId: string;
    conforming: number;
    nonconforming: number;
    observation: number;
    not_applicable: number;
    unevaluated: number;
  }>;
  findings: Array<{
    id: string;
    title: string;
    description: string | null;
    severity: string;
    status: string;
    elementId: string | null;
    remediationPlan: string | null;
    remediationDueDate: string | null;
    createdAt: string;
    riskId?: string | null;
  }>;
  findingsBySeverity: Record<string, number>;
  nonconformingItems: Array<{
    id: string;
    question: string;
    notes: string | null;
    completedAt: string | null;
  }>;
  affectedRisks: Array<{
    riskId: string;
    title: string | null;
    category: string | null;
    status: string | null;
    riskScoreResidual: number | null;
    linkedFindingCount: number;
    maxSeverity: string | null;
    openFindingCount: number;
    needsReassessment: boolean;
    hasTreatmentFromAudit: boolean;
  }>;
  affectedControls: Array<{
    controlId: string;
    title: string | null;
    controlType: string | null;
    openFindingCount: number;
    maxSeverity: string | null;
  }>;
  generatedAt: string;
}

function ReportTab({ audit }: { audit: AuditDetail }) {
  const t = useTranslations("auditMgmt");
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/v1/audit-mgmt/audits/${params.id}/report`,
        );
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = await res.json();
        if (!cancelled) setReport(json.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <Loader2 size={16} className="animate-spin text-gray-400" />
      </div>
    );
  }
  if (!report) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-400">
          Bericht konnte nicht geladen werden.
        </p>
      </div>
    );
  }

  const sevColors: Record<string, string> = {
    significant_nonconformity: "bg-red-100 text-red-900 border-red-200",
    insignificant_nonconformity:
      "bg-orange-100 text-orange-900 border-orange-200",
    improvement_requirement: "bg-yellow-100 text-yellow-900 border-yellow-200",
    observation: "bg-blue-100 text-blue-900 border-blue-200",
    recommendation: "bg-gray-100 text-gray-800 border-gray-200",
  };
  const sevLabels: Record<string, string> = {
    significant_nonconformity: "Wesentliche Abweichung",
    insignificant_nonconformity: "Geringfügige Abweichung",
    improvement_requirement: "Verbesserungsanforderung",
    observation: "Beobachtung",
    recommendation: "Empfehlung",
  };

  const totalEvaluated = report.breakdown.reduce(
    (sum, b) =>
      sum + b.conforming + b.nonconforming + b.observation + b.not_applicable,
    0,
  );
  const totalItems = report.breakdown.reduce(
    (sum, b) =>
      sum +
      b.conforming +
      b.nonconforming +
      b.observation +
      b.not_applicable +
      b.unevaluated,
    0,
  );
  const conformanceRate =
    totalEvaluated > 0
      ? Math.round(
          (report.breakdown.reduce((s, b) => s + b.conforming, 0) /
            totalEvaluated) *
            100,
        )
      : 0;

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{t("report")}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Drucken / Als PDF speichern
          </Button>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3 print:border-0">
        <h3 className="text-sm font-semibold text-gray-900">
          Executive Summary
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <InfoRow label="Audit" value={report.audit.title} />
          <InfoRow label="Status" value={report.audit.status} />
          <InfoRow
            label={t("conclusion")}
            value={
              report.audit.conclusion
                ? t(`conclusions.${report.audit.conclusion}`)
                : "-"
            }
          />
          <InfoRow label="Audit-Typ" value={report.audit.auditType} />
          <InfoRow
            label="Leitender Prüfer"
            value={report.audit.leadAuditorName ?? "-"}
          />
          <InfoRow
            label="E-Mail"
            value={(report.audit as any).leadAuditorEmail ?? "-"}
          />
          <InfoRow
            label={t("actualStart")}
            value={report.audit.actualStart ?? "-"}
          />
          <InfoRow
            label={t("actualEnd")}
            value={report.audit.actualEnd ?? "-"}
          />
        </div>
        {report.audit.description && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-gray-500 mb-1">
              Beschreibung
            </p>
            <p className="text-sm text-gray-700">{report.audit.description}</p>
          </div>
        )}
      </div>

      {/* Scope */}
      {(report.audit.scopeDescription ||
        report.audit.scopeFrameworks?.length ||
        report.audit.scopeDepartments?.length ||
        report.audit.scopeProcesses?.length) && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Geltungsbereich
          </h3>
          {report.audit.scopeDescription && (
            <p className="text-sm text-gray-700">
              {report.audit.scopeDescription}
            </p>
          )}
          {report.audit.scopeFrameworks?.length ? (
            <InfoRow
              label="Frameworks"
              value={report.audit.scopeFrameworks.join(", ")}
            />
          ) : null}
          {report.audit.scopeDepartments?.length ? (
            <InfoRow
              label="Abteilungen"
              value={report.audit.scopeDepartments.join(", ")}
            />
          ) : null}
          {report.audit.scopeProcesses?.length ? (
            <InfoRow
              label="Prozesse"
              value={report.audit.scopeProcesses.join(", ")}
            />
          ) : null}
        </div>
      )}

      {/* Checklist Conformance */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Checklisten-Auswertung
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label="Konform"
            value={report.breakdown.reduce((s, b) => s + b.conforming, 0)}
            color="bg-green-50 text-green-900"
          />
          <StatCard
            label="Nicht konform"
            value={report.breakdown.reduce((s, b) => s + b.nonconforming, 0)}
            color="bg-red-50 text-red-900"
          />
          <StatCard
            label="Beobachtung"
            value={report.breakdown.reduce((s, b) => s + b.observation, 0)}
            color="bg-blue-50 text-blue-900"
          />
          <StatCard
            label="Nicht anwendbar"
            value={report.breakdown.reduce((s, b) => s + b.not_applicable, 0)}
            color="bg-gray-50 text-gray-800"
          />
          <StatCard
            label="Unbewertet"
            value={report.breakdown.reduce((s, b) => s + b.unevaluated, 0)}
            color="bg-yellow-50 text-yellow-900"
          />
        </div>
        <div className="pt-2 text-xs text-gray-500">
          Konformitätsgrad (bewertete Items):{" "}
          <span className="font-semibold text-gray-900">
            {conformanceRate}%
          </span>{" "}
          · Bewertet: {totalEvaluated} / {totalItems}
        </div>
        {report.checklists.length > 0 && (
          <div className="text-xs text-gray-500 pt-1">
            Checklisten:{" "}
            {report.checklists
              .map((cl) => `${cl.name} (${cl.completedItems}/${cl.totalItems})`)
              .join(" · ")}
          </div>
        )}
      </div>

      {/* Findings */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Feststellungen ({report.findings.length})
          </h3>
        </div>
        {Object.keys(report.findingsBySeverity).length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(report.findingsBySeverity).map(([sev, cnt]) => (
              <span
                key={sev}
                className={`px-2 py-1 rounded-full border ${sevColors[sev] ?? "bg-gray-100 text-gray-800 border-gray-200"}`}
              >
                {sevLabels[sev] ?? sev}: <strong>{cnt}</strong>
              </span>
            ))}
          </div>
        )}
        {report.findings.length === 0 ? (
          <p className="text-sm text-gray-400">Keine Feststellungen.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {report.findings.map((f) => (
              <FindingRow
                key={f.id}
                finding={f}
                sevColors={sevColors}
                sevLabels={sevLabels}
                onUpdated={() => {
                  // Refetch the report data after saving
                  fetch(`/api/v1/audit-mgmt/audits/${params.id}/report`)
                    .then((r) => r.json())
                    .then((json) => setReport(json.data))
                    .catch(() => {});
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Betroffene Risiken (Audit → ERM Feedback-Loop) */}
      {report.affectedRisks && report.affectedRisks.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Betroffene Risiken ({report.affectedRisks.length})
            </h3>
            <span className="text-xs text-gray-500">
              ISO 27001 9.2 · ISO 31000 6.6
            </span>
          </div>
          <ul className="divide-y divide-gray-100">
            {report.affectedRisks.map((r) => (
              <li
                key={r.riskId}
                className="py-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.needsReassessment && (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full border bg-red-100 text-red-900 border-red-200 font-medium">
                        Neubewertung erforderlich
                      </span>
                    )}
                    {r.hasTreatmentFromAudit && (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full border bg-green-100 text-green-900 border-green-200">
                        Treatment aus Audit übernommen
                      </span>
                    )}
                    {r.maxSeverity && (
                      <span
                        className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${sevColors[r.maxSeverity] ?? "bg-gray-100 border-gray-200"}`}
                      >
                        max. {sevLabels[r.maxSeverity] ?? r.maxSeverity}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      · Status: {r.status ?? "-"}
                    </span>
                    {r.category && (
                      <span className="text-xs text-gray-400">
                        · {r.category}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {r.title ?? "(ohne Titel)"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.linkedFindingCount} Feststellung
                    {r.linkedFindingCount === 1 ? "" : "en"} aus diesem Audit
                    {r.openFindingCount > 0 && ` · ${r.openFindingCount} offen`}
                    {r.riskScoreResidual != null &&
                      ` · Residualrisiko: ${r.riskScoreResidual}`}
                  </p>
                </div>
                <Link
                  href={`/risks/${r.riskId}`}
                  className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap print:hidden"
                >
                  Risiko ansehen →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Betroffene Kontrollen (Audit → ISMS Feedback-Loop) */}
      {report.affectedControls && report.affectedControls.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Betroffene Kontrollen ({report.affectedControls.length})
            </h3>
            <span className="text-xs text-gray-500">
              ISO 27001 Annex A Wirksamkeitsnachweis
            </span>
          </div>
          <ul className="divide-y divide-gray-100">
            {report.affectedControls.map((c) => (
              <li
                key={c.controlId}
                className="py-2 flex items-start justify-between gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.maxSeverity && (
                      <span
                        className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${sevColors[c.maxSeverity] ?? "bg-gray-100 border-gray-200"}`}
                      >
                        max. {sevLabels[c.maxSeverity] ?? c.maxSeverity}
                      </span>
                    )}
                    {c.controlType && (
                      <span className="text-xs text-gray-400">
                        {c.controlType}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {c.title ?? "(ohne Titel)"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.openFindingCount} offene Feststellung
                    {c.openFindingCount === 1 ? "" : "en"}
                  </p>
                </div>
                <Link
                  href={`/controls/${c.controlId}`}
                  className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap print:hidden"
                >
                  Kontrolle ansehen →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Nonconforming items (source of findings) */}
      {report.nonconformingItems.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Nicht konforme Checklisten-Positionen
          </h3>
          <ul className="divide-y divide-gray-100">
            {report.nonconformingItems.map((it) => (
              <li key={it.id} className="py-2">
                <p className="text-sm text-gray-800">{it.question}</p>
                {it.notes && (
                  <p className="text-xs text-gray-500 mt-1">
                    Notiz: {it.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-400 text-right">
        Bericht generiert:{" "}
        {new Date(report.generatedAt).toLocaleString("de-DE")}
      </p>

      {audit.reportDocumentId && (
        <Link
          href={`/documents/${audit.reportDocumentId}`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {t("viewReport")}
        </Link>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-md p-3 ${color}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

// ─── Finding Row (with inline Treatment Plan editor) ─────────

function FindingRow({
  finding,
  sevColors,
  sevLabels,
  onUpdated,
}: {
  finding: ReportData["findings"][number];
  sevColors: Record<string, string>;
  sevLabels: Record<string, string>;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState(finding.remediationPlan ?? "");
  const [due, setDue] = useState(finding.remediationDueDate ?? "");
  // Default to syncing when the finding is already linked to a risk —
  // skipping sync on a risk-linked finding is the exception, not the rule.
  const hasRiskLink = !!finding.riskId;
  const [syncToRiskTreatment, setSyncToRiskTreatment] = useState(hasRiskLink);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/findings/${finding.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remediationPlan: plan.trim() || null,
          remediationDueDate: due || null,
        }),
      });
      if (!res.ok) return;

      // Propagate to risk_treatment when the user opted in (and a risk is
      // linked + a plan text exists). The endpoint is idempotent, so a
      // second save updates the existing treatment instead of duplicating.
      if (syncToRiskTreatment && hasRiskLink && plan.trim()) {
        await fetch(`/api/v1/findings/${finding.id}/sync-treatment`, {
          method: "POST",
        }).catch(() => {});
      }

      setEditing(false);
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${sevColors[finding.severity] ?? "bg-gray-100 border-gray-200"}`}
            >
              {sevLabels[finding.severity] ?? finding.severity}
            </span>
            {finding.elementId && (
              <span className="text-xs text-gray-400">{finding.elementId}</span>
            )}
            <span className="text-xs text-gray-400">
              · Status: {finding.status}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {finding.title}
          </p>
          {finding.description && (
            <p className="text-sm text-gray-600 mt-0.5">
              {finding.description}
            </p>
          )}
        </div>
        {!editing && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            className="print:hidden"
          >
            {finding.remediationPlan
              ? "Maßnahme bearbeiten"
              : "Maßnahme erfassen"}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 space-y-2 print:hidden">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Maßnahmen-Plan
            </label>
            <textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Welche Maßnahme(n) werden ergriffen, um die Feststellung zu beheben?"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Fälligkeitsdatum
            </label>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          {hasRiskLink && (
            <label className="flex items-start gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={syncToRiskTreatment}
                onChange={(e) => setSyncToRiskTreatment(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded text-blue-600"
              />
              <span className="text-xs text-gray-700">
                <strong>Als Risk-Treatment übernehmen.</strong> Der Plan wird
                automatisch in das verknüpfte Risiko als formale Maßnahme
                eingetragen (ISO 31000 6.6). Idempotent — wiederholtes Speichern
                aktualisiert den bestehenden Treatment-Eintrag.
              </span>
            </label>
          )}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? (
                <Loader2 size={12} className="animate-spin mr-1" />
              ) : null}
              Speichern
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setPlan(finding.remediationPlan ?? "");
                setDue(finding.remediationDueDate ?? "");
                setSyncToRiskTreatment(hasRiskLink);
              }}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      ) : (
        (finding.remediationPlan || finding.remediationDueDate) && (
          <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700 space-y-0.5">
            {finding.remediationPlan && (
              <p>
                <strong>Maßnahmen-Plan:</strong> {finding.remediationPlan}
              </p>
            )}
            {finding.remediationDueDate && (
              <p>
                <strong>Fällig:</strong> {finding.remediationDueDate}
              </p>
            )}
          </div>
        )
      )}
    </li>
  );
}
