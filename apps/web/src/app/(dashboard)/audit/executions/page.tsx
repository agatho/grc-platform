"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, RefreshCcw, Search } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { ModuleTabNav } from "@/components/layout/module-tab-nav";
import { AuditQuickStatsBar } from "@/components/audit/audit-quick-stats-bar";
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
import type { Audit } from "@grc/shared";

interface AuditWithLead extends Audit {
  leadAuditorName?: string | null;
}

export default function ExecutionsPage() {
  return (
    <ModuleGate moduleKey="audit">
      <ModuleTabNav />
      <AuditQuickStatsBar className="mb-4" />
      <ExecutionsInner />
    </ModuleGate>
  );
}

interface AuditorOption {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

function ExecutionsInner() {
  const t = useTranslations("auditMgmt");
  const router = useRouter();
  const [audits, setAudits] = useState<AuditWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [auditors, setAuditors] = useState<AuditorOption[]>([]);

  // Org-Auditor:innen laden — wird im Create-Form für Lead-Auditor-Dropdown
  // + Auditor-Team-Multi-Select genutzt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/v1/audit-mgmt/auditors");
        if (r.ok) {
          const j = await r.json();
          if (!cancelled) setAuditors(j.data ?? []);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/v1/audit-mgmt/audits?${params}`);
      if (res.ok) {
        const json = await res.json();
        setAudits(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    void fetchAudits();
  }, [fetchAudits]);

  const handleCreate = async (formData: FormData) => {
    const parseCsv = (v: string | null): string[] | undefined => {
      if (!v) return undefined;
      const arr = v
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    };

    // Multi-Select Auditor-Team: checkboxes → array aus FormData.getAll
    const auditorIdsRaw = formData.getAll("auditorIds") as string[];

    const body: Record<string, unknown> = {
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      auditType: formData.get("auditType") as string,
      plannedStart: (formData.get("plannedStart") as string) || undefined,
      plannedEnd: (formData.get("plannedEnd") as string) || undefined,
      scopeDescription:
        (formData.get("scopeDescription") as string) || undefined,
      scopeProcesses: parseCsv(formData.get("scopeProcesses") as string),
      scopeDepartments: parseCsv(formData.get("scopeDepartments") as string),
      scopeFrameworks: parseCsv(formData.get("scopeFrameworks") as string),
      leadAuditorId:
        (formData.get("leadAuditorId") as string) || undefined,
      auditorIds:
        auditorIdsRaw.filter(Boolean).length > 0
          ? auditorIdsRaw.filter(Boolean)
          : undefined,
    };

    const res = await fetch("/api/v1/audit-mgmt/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setDialogOpen(false);
      void fetchAudits();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(
        `Anlegen fehlgeschlagen: ${j.error ?? res.statusText} (HTTP ${res.status})`,
      );
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { className: string; label: string }> = {
      planned: {
        className: "bg-gray-100 text-gray-700 border-gray-300",
        label: t("auditStatus.planned"),
      },
      preparation: {
        className: "bg-blue-100 text-blue-900 border-blue-300",
        label: t("auditStatus.preparation"),
      },
      fieldwork: {
        className: "bg-yellow-100 text-yellow-900 border-yellow-300",
        label: t("auditStatus.fieldwork"),
      },
      reporting: {
        className: "bg-orange-100 text-orange-900 border-orange-300",
        label: t("auditStatus.reporting"),
      },
      review: {
        className: "bg-purple-100 text-purple-900 border-purple-300",
        label: t("auditStatus.review"),
      },
      completed: {
        className: "bg-green-100 text-green-900 border-green-300",
        label: t("auditStatus.completed"),
      },
      cancelled: {
        className: "bg-red-100 text-red-900 border-red-300",
        label: t("auditStatus.cancelled"),
      },
    };
    const config = map[status] ?? map.planned;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const auditTypeBadge = (type: string) => {
    const map: Record<string, string> = {
      internal: t("auditTypes.internal"),
      external: t("auditTypes.external"),
      certification: t("auditTypes.certification"),
      surveillance: t("auditTypes.surveillance"),
      follow_up: t("auditTypes.followUp"),
    };
    return <Badge variant="outline">{map[type] ?? type}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("executions")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("executionsSubtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAudits}
            disabled={loading}
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={14} className="mr-1" />
                {t("createAudit")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("createAudit")}</DialogTitle>
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
                    {t("auditTitle")}
                  </label>
                  <Input name="title" required />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {t("description")}
                  </label>
                  <textarea
                    name="description"
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Audit-Zweck, Anlass, Auftraggeber, Berichtsempfänger …"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {t("auditType")}
                  </label>
                  <select
                    name="auditType"
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="internal">{t("auditTypes.internal")}</option>
                    <option value="external">{t("auditTypes.external")}</option>
                    <option value="certification">
                      {t("auditTypes.certification")}
                    </option>
                    <option value="surveillance">
                      {t("auditTypes.surveillance")}
                    </option>
                    <option value="follow_up">
                      {t("auditTypes.followUp")}
                    </option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">
                      {t("plannedStart")}
                    </label>
                    <Input name="plannedStart" type="date" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      {t("plannedEnd")}
                    </label>
                    <Input name="plannedEnd" type="date" />
                  </div>
                </div>

                {/* Auditor-Zuweisung — Lead + Team (ISO 19011 § 5.4) */}
                <fieldset className="border border-gray-200 rounded-md p-3 space-y-3">
                  <legend className="text-xs font-semibold text-gray-600 px-1">
                    Auditor-Team (ISO 19011 § 5.4.4)
                  </legend>
                  <div>
                    <label className="text-sm font-medium">Lead-Auditor</label>
                    <select
                      name="leadAuditorId"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      defaultValue=""
                    >
                      <option value="">— niemand zugewiesen —</option>
                      {auditors.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name ?? u.email}
                          {u.role === "admin" ? " (admin)" : ""}
                        </option>
                      ))}
                    </select>
                    {auditors.length === 0 && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Keine Nutzer mit Rolle „auditor" oder „admin" in
                        dieser Org — zuerst unter /settings/users zuweisen.
                      </p>
                    )}
                  </div>
                  {auditors.length > 0 && (
                    <div>
                      <label className="text-sm font-medium">
                        Audit-Team (Mitglieder)
                      </label>
                      <div className="rounded-md border border-gray-200 p-2 max-h-40 overflow-y-auto space-y-1">
                        {auditors.map((u) => (
                          <label
                            key={u.id}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded"
                          >
                            <input
                              type="checkbox"
                              name="auditorIds"
                              value={u.id}
                              className="h-4 w-4"
                            />
                            <span>{u.name ?? u.email}</span>
                            {u.role === "admin" && (
                              <span className="text-[10px] text-gray-400">
                                · admin
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </fieldset>

                <fieldset className="border border-gray-200 rounded-md p-3 space-y-3">
                  <legend className="text-xs font-semibold text-gray-600 px-1">
                    Audit-Umfang (ISO 19011 § 5.4)
                  </legend>
                  <div>
                    <label className="text-sm font-medium">
                      Scope-Beschreibung
                    </label>
                    <textarea
                      name="scopeDescription"
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Welche Organisationsteile, Standorte, Systeme, Zeitraum werden geprüft?"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-sm font-medium">
                        Prozesse{" "}
                        <span className="text-xs font-normal text-gray-400">
                          (kommagetrennt)
                        </span>
                      </label>
                      <Input
                        name="scopeProcesses"
                        placeholder="z. B. Identitätsverwaltung, Patch-Management, Backup"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Abteilungen / Standorte{" "}
                        <span className="text-xs font-normal text-gray-400">
                          (kommagetrennt)
                        </span>
                      </label>
                      <Input
                        name="scopeDepartments"
                        placeholder="z. B. IT, HR, Standort Berlin, Standort Wien"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        Geprüfte Frameworks{" "}
                        <span className="text-xs font-normal text-gray-400">
                          (kommagetrennt)
                        </span>
                      </label>
                      <Input
                        name="scopeFrameworks"
                        placeholder="z. B. ISO 27001, CIS Controls v8 IG2, NIS2"
                      />
                    </div>
                  </div>
                </fieldset>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button type="submit">{t("save")}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder={t("searchAudits")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">{t("allStatuses")}</option>
          <option value="planned">{t("auditStatus.planned")}</option>
          <option value="preparation">{t("auditStatus.preparation")}</option>
          <option value="fieldwork">{t("auditStatus.fieldwork")}</option>
          <option value="reporting">{t("auditStatus.reporting")}</option>
          <option value="review">{t("auditStatus.review")}</option>
          <option value="completed">{t("auditStatus.completed")}</option>
          <option value="cancelled">{t("auditStatus.cancelled")}</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : audits.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {t("emptyAudits")}
        </div>
      ) : (
        <div className="space-y-3">
          {audits.map((a) => (
            <Link
              key={a.id}
              href={`/audit/executions/${a.id}`}
              className="block rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{a.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {a.leadAuditorName
                      ? `${t("lead")}: ${a.leadAuditorName}`
                      : ""}{" "}
                    {a.plannedStart ? `| ${a.plannedStart}` : ""}{" "}
                    {a.plannedEnd ? `- ${a.plannedEnd}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {auditTypeBadge(a.auditType)}
                  {statusBadge(a.status)}
                  {(a.findingCount ?? 0) > 0 && (
                    <Badge variant="destructive">
                      {a.findingCount} {t("findings")}
                    </Badge>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
