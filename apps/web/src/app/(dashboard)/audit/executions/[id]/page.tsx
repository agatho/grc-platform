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
  Trash2,
  Paperclip,
  X,
  Download,
  Copy,
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
  MethodEntry,
} from "@grc/shared";
import { checklistResultToFindingSeverity } from "@grc/shared";

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  // Transition-Dialog: wenn Audit in "completed"/"review" wechselt, braucht
  // es laut ISO 19011 § 6.5 eine formale Audit-Konklusion.
  const [transitionTo, setTransitionTo] = useState<string | null>(null);
  // Closure-Readiness-Blocker (aus dem Endpoint closure-readiness),
  // angezeigt im Transition-Dialog damit der Auditor bewusst abschließt.
  const [closureBlockers, setClosureBlockers] = useState<
    Array<{ kind: string; message: string; severity: "warning" | "error" }>
  >([]);

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
    // ISO 19011 § 6.5: Audit-Konklusion beim Übergang in "review"/"completed"
    // zwingend erforderlich. UI öffnet Dialog statt still zu transitionieren.
    const needsConclusion =
      (newStatus === "review" || newStatus === "completed") && !conclusion;
    if (needsConclusion) {
      setTransitionTo(newStatus);
      // Closure-Readiness-Check aufrufen für Warnungen
      try {
        const r = await fetch(
          `/api/v1/audit-mgmt/audits/${params.id}/closure-readiness`,
        );
        if (r.ok) {
          const j = await r.json();
          setClosureBlockers(j.data?.blockers ?? []);
        }
      } catch {
        // ignore
      }
      return;
    }

    const body: Record<string, string> = { status: newStatus };
    if (conclusion) body.conclusion = conclusion;

    const res = await fetch(`/api/v1/audit-mgmt/audits/${params.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setTransitionTo(null);
      void fetchAudit();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(
        `Statuswechsel fehlgeschlagen: ${j.error ?? res.statusText} (HTTP ${res.status})`,
      );
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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{audit.title}</h1>
            {statusBadge(audit.status)}
            {audit.conclusion && (
              <Badge
                className={
                  audit.conclusion === "conforming"
                    ? "bg-green-100 text-green-900 border-green-200"
                    : audit.conclusion === "minor_nonconformity"
                      ? "bg-orange-100 text-orange-900 border-orange-200"
                      : audit.conclusion === "major_nonconformity"
                        ? "bg-red-100 text-red-900 border-red-200"
                        : "bg-gray-100 text-gray-700 border-gray-200"
                }
              >
                {audit.conclusion === "conforming" && "✓ Konform"}
                {audit.conclusion === "minor_nonconformity" &&
                  "◆ Mit Nebenabweichung"}
                {audit.conclusion === "major_nonconformity" &&
                  "✗ Mit Hauptabweichung"}
                {audit.conclusion === "not_applicable" && "— N/A"}
              </Badge>
            )}
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
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditDialogOpen(true)}
        >
          Details bearbeiten
        </Button>
        {nextStatus[audit.status] && (
          <Button
            size="sm"
            onClick={() => handleStatusChange(nextStatus[audit.status])}
          >
            {t("advanceTo")} {t(`auditStatus.${nextStatus[audit.status]}`)}
          </Button>
        )}
      </div>

      {/* Edit-Audit-Dialog (Vollfeld-Editor) */}
      <AuditEditDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        audit={audit}
        onSaved={() => {
          setEditDialogOpen(false);
          void fetchAudit();
        }}
      />

      {/* Transition-Dialog: Conclusion-Capture beim Übergang nach review/completed */}
      <Dialog
        open={transitionTo !== null}
        onOpenChange={(o) => {
          if (!o) {
            setTransitionTo(null);
            setClosureBlockers([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Übergang zu „{transitionTo ? t(`auditStatus.${transitionTo}`) : ""}" — Audit-Konklusion erforderlich
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
              ISO 19011 § 6.5: Beim Abschluss eines Audits muss eine formale
              Konklusion dokumentiert sein. Diese fließt in den Audit-Report
              und die Management-Review-Aggregation ein.
            </div>

            {/* Closure-Readiness-Hinweise */}
            {closureBlockers.length > 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-300 p-3 text-xs">
                <p className="font-semibold text-amber-900 mb-2">
                  Review vor Abschluss — folgende Punkte sind offen:
                </p>
                <ul className="space-y-1">
                  {closureBlockers.map((b) => (
                    <li
                      key={b.kind}
                      className={`flex items-start gap-2 ${
                        b.severity === "error"
                          ? "text-red-900"
                          : "text-amber-900"
                      }`}
                    >
                      <span>{b.severity === "error" ? "✗" : "⚠"}</span>
                      <span>{b.message}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-amber-700">
                  Warnungen können ignoriert werden, Fehler müssen behoben sein
                  (z. B. Konklusion-Feld unten ausfüllen).
                </p>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const conclusion = fd.get("conclusion") as string;
                if (transitionTo && conclusion) {
                  void handleStatusChange(transitionTo, conclusion);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-sm font-medium">Audit-Konklusion</label>
                <select
                  name="conclusion"
                  required
                  defaultValue={audit.conclusion ?? ""}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">— Konklusion wählen —</option>
                  <option value="conforming">
                    ✓ Konform — Management-System erfüllt die Kriterien
                  </option>
                  <option value="minor_nonconformity">
                    ◆ Mit Nebenabweichung — isolierte Lücke(n), Korrektur
                    dokumentiert
                  </option>
                  <option value="major_nonconformity">
                    ✗ Mit Hauptabweichung — systemische Lücke, Zertifizierung
                    blockiert
                  </option>
                  <option value="not_applicable">
                    — Nicht anwendbar / Audit abgebrochen
                  </option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTransitionTo(null)}
                >
                  Abbrechen
                </Button>
                <Button type="submit">Status setzen</Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Context-Tip — führt Auditor:innen zur nächsten sinnvollen Aktion
          je nach Audit-Phase (ISO 19011 § 6). */}
      {(() => {
        const tip = ((): { text: string; action?: string } | null => {
          switch (audit.status) {
            case "planned":
              return {
                text: 'Audit ist in Planung — pflege Scope, Auditor-Team und geplante Daten über "Details bearbeiten".',
              };
            case "preparation":
              return {
                text: 'Vorbereitung läuft — generiere Checklisten aus aktiven Katalogen (CIS IG1/2/3, ISO 27001 Annex A) und plane das Eröffnungsgespräch über "Activities".',
              };
            case "fieldwork":
              return {
                text: "Feldarbeit — bewerte Items im Checklisten-Tab, protokolliere Interviews und Tests als Activities, erfasse Evidenzen.",
              };
            case "reporting":
              return {
                text: 'Report-Phase — öffne Findings-Tab und nutze "Alle NC → Findings" für Bulk-Konvertierung, dann im Report-Tab Maßnahmen-Pläne erfassen.',
              };
            case "review":
              return {
                text: "Review — prüfe den Report-Tab, verifiziere alle Findings, dann übergib an Management-Review (ISO 27001 § 9.3).",
              };
            default:
              return null;
          }
        })();
        if (!tip) return null;
        return (
          <div className="rounded-md bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-900 print:hidden">
            💡 <span className="font-medium">Nächster Schritt:</span> {tip.text}
          </div>
        );
      })()}

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

// ─── Vollfeld-Editor für Audit-Details ───────────────────────
// Deckt die Felder ab, die ISO 19011 / IIA 2330 verlangen, aber die
// bisher in Create-Form + Read-only-Overview versteckt waren:
//   scope{Description, Processes, Departments, Frameworks}, actual dates,
//   conclusion, auditorIds (kommagetrennt). Lead-/Auditee-IDs sind UUIDs
//   und werden hier NICHT als Freitext gepflegt — dafür braucht es den
//   User-Picker (separate Story).

function AuditEditDialog({
  open,
  onClose,
  audit,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  audit: AuditDetail;
  onSaved: () => void;
}) {
  const t = useTranslations("auditMgmt");
  const [saving, setSaving] = useState(false);
  const [auditors, setAuditors] = useState<
    Array<{ id: string; name: string | null; email: string; role: string }>
  >([]);

  // Lade Auditor-Liste einmalig beim Öffnen des Dialogs
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const handleSave = async (formData: FormData) => {
    const parseCsv = (v: string | null): string[] | undefined => {
      if (!v) return undefined;
      const arr = v
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    };

    const auditorIdsRaw = formData.getAll("auditorIds") as string[];

    const body: Record<string, unknown> = {
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      scopeDescription:
        (formData.get("scopeDescription") as string) || undefined,
      scopeProcesses: parseCsv(formData.get("scopeProcesses") as string),
      scopeDepartments: parseCsv(formData.get("scopeDepartments") as string),
      scopeFrameworks: parseCsv(formData.get("scopeFrameworks") as string),
      plannedStart: (formData.get("plannedStart") as string) || undefined,
      plannedEnd: (formData.get("plannedEnd") as string) || undefined,
      leadAuditorId:
        (formData.get("leadAuditorId") as string) || undefined,
      auditorIds:
        auditorIdsRaw.filter(Boolean).length > 0
          ? auditorIdsRaw.filter(Boolean)
          : [],
      // actualStart/End + conclusion werden via Status-Transition-Endpoint
      // gepflegt, NICHT via PUT /audits/[id] (dessen Schema updateAuditSchema
      // enthält sie nicht). Wir fassen deshalb nur Planungs-/Scope-Felder an.
    };

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/audit-mgmt/audits/${audit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onSaved();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(
          `Speichern fehlgeschlagen: ${j.error ?? res.statusText} (HTTP ${res.status})`,
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Audit-Details bearbeiten</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave(new FormData(e.currentTarget));
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-sm font-medium">{t("auditTitle")}</label>
            <Input name="title" required defaultValue={audit.title} />
          </div>
          <div>
            <label className="text-sm font-medium">{t("description")}</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={audit.description ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">{t("plannedStart")}</label>
              <Input
                name="plannedStart"
                type="date"
                defaultValue={audit.plannedStart ?? ""}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t("plannedEnd")}</label>
              <Input
                name="plannedEnd"
                type="date"
                defaultValue={audit.plannedEnd ?? ""}
              />
            </div>
          </div>

          {/* Auditor-Team */}
          <fieldset className="border border-gray-200 rounded-md p-3 space-y-3">
            <legend className="text-xs font-semibold text-gray-600 px-1">
              Auditor-Team (ISO 19011 § 5.4.4)
            </legend>
            <div>
              <label className="text-sm font-medium">Lead-Auditor</label>
              <select
                name="leadAuditorId"
                defaultValue={audit.leadAuditorId ?? ""}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— niemand zugewiesen —</option>
                {auditors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email}
                    {u.role === "admin" ? " (admin)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {auditors.length > 0 && (
              <div>
                <label className="text-sm font-medium">Audit-Team</label>
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
                        defaultChecked={
                          audit.auditorIds?.includes(u.id) ?? false
                        }
                        className="h-4 w-4"
                      />
                      <span>{u.name ?? u.email}</span>
                      {u.role === "admin" && (
                        <span className="text-[10px] text-gray-400">· admin</span>
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
              <label className="text-sm font-medium">Scope-Beschreibung</label>
              <textarea
                name="scopeDescription"
                rows={2}
                defaultValue={audit.scopeDescription ?? ""}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Welche Organisationsteile, Standorte, Systeme, Zeitraum?"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Prozesse{" "}
                <span className="text-xs font-normal text-gray-400">
                  (kommagetrennt)
                </span>
              </label>
              <Input
                name="scopeProcesses"
                defaultValue={(audit.scopeProcesses ?? []).join(", ")}
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
                defaultValue={(audit.scopeDepartments ?? []).join(", ")}
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
                defaultValue={(audit.scopeFrameworks ?? []).join(", ")}
                placeholder="z. B. ISO 27001, CIS Controls v8 IG2, NIS2"
              />
            </div>
          </fieldset>

          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
            <strong>Hinweis:</strong> Tatsächliche Start-/Endtermine und die
            Audit-Konklusion werden beim Statuswechsel gesetzt (Buttons oben
            rechts: „Weiter zu…"). Findings + Auditor-Zuweisungen pflegst du in
            den jeweiligen Tabs.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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

// ─── ISO-19011-konforme Labels (DE) ──────────────────────────
// Zentral, damit Items-Tabelle + Dialog + Report identisch beschriften.
function resultLabel(r: string | null | undefined): string {
  switch (r) {
    case "positive":
      return "Positiv-Bewertung";
    case "conforming":
      return "Konform";
    case "opportunity_for_improvement":
      return "Hinweis (OFI)";
    case "observation":
      return "Feststellung";
    case "minor_nonconformity":
      return "Nebenabweichung";
    case "major_nonconformity":
      return "Hauptabweichung";
    case "nonconforming":
      return "Abweichung (Legacy)";
    case "not_applicable":
      return "Nicht anwendbar";
    default:
      return "Offen";
  }
}

function methodLabel(m: string | null | undefined): string {
  switch (m) {
    case "interview":
      return "Interview";
    case "document_review":
      return "Dokumentenprüfung";
    case "observation":
      return "Beobachtung";
    case "walkthrough":
      return "Walkthrough";
    case "technical_test":
      return "Tech-Test";
    case "sampling":
      return "Stichprobe";
    case "reperformance":
      return "Reperformance";
    default:
      return m ?? "";
  }
}

function methodIcon(m: string | null | undefined): string {
  switch (m) {
    case "interview":
      return "👤";
    case "document_review":
      return "📄";
    case "observation":
      return "👁";
    case "walkthrough":
      return "🚶";
    case "technical_test":
      return "🔧";
    case "sampling":
      return "🎯";
    case "reperformance":
      return "🔁";
    default:
      return "•";
  }
}

// ─── MethodEntriesEditor ─────────────────────────────────────
// Liste typisierter Audit-Nachweise. Jeder Eintrag ist ein eigener Nachweis
// mit method-spezifischen Feldern (Interview → Person, Stichprobe → Population+IDs,
// etc.). Der:die Auditor:in kann beliebig viele Einträge anlegen — pro Bewertung
// sind üblicherweise 2–4 Nachweise nötig (ISO 19011 § 6.4.7 Abs. 2).

type MethodKind = MethodEntry["method"];

// Lokaler Typ für teilweise ausgefüllte Entries (während Eingabe);
// id bleibt immer gesetzt.
type EditableMethodEntry = Partial<MethodEntry> & {
  id: string;
  method: MethodKind;
};

function newMethodEntry(method: MethodKind): EditableMethodEntry {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return { id, method };
}

function MethodEntriesEditor({
  value,
  onChange,
}: {
  value: EditableMethodEntry[];
  onChange: (next: EditableMethodEntry[]) => void;
}) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const update = (id: string, patch: Partial<EditableMethodEntry>) => {
    onChange(
      value.map((e) => (e.id === id ? ({ ...e, ...patch } as EditableMethodEntry) : e)),
    );
  };
  const remove = (id: string) => {
    onChange(value.filter((e) => e.id !== id));
  };
  const add = (method: MethodKind) => {
    onChange([...value, newMethodEntry(method)]);
    setAddMenuOpen(false);
  };

  return (
    <div className="space-y-2">
      {/* Entries */}
      {value.length === 0 && (
        <div className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-md p-4 text-center">
          Noch keine Nachweise erfasst. Unten „+ Nachweis hinzufügen" klicken —
          pro Methode erscheint ein eigenes Mini-Formular mit den passenden
          Feldern (z. B. Interview → Person, Stichprobe → Population + IDs).
        </div>
      )}
      {value.map((entry, idx) => (
        <MethodEntryCard
          key={entry.id}
          entry={entry}
          index={idx}
          onChange={(patch) => update(entry.id, patch)}
          onRemove={() => remove(entry.id)}
        />
      ))}

      {/* Add-Dropdown */}
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAddMenuOpen((v) => !v)}
        >
          <Plus size={14} className="mr-1" />
          Nachweis hinzufügen
          <ChevronDown size={12} className="ml-1" />
        </Button>
        {addMenuOpen && (
          <div className="absolute left-0 top-full mt-1 w-72 rounded-md border border-gray-200 bg-white shadow-lg z-20">
            {(
              [
                ["interview", "Interview / Befragung"],
                ["document_review", "Dokumentenprüfung"],
                ["observation", "Begehung / Beobachtung"],
                ["walkthrough", "Walkthrough"],
                ["technical_test", "Technischer Test"],
                ["sampling", "Stichprobe"],
                ["reperformance", "Reperformance"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => add(m)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2"
              >
                <span className="w-5 text-center">{methodIcon(m)}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {value.length >= 2 && (
        <p className="text-[11px] text-emerald-600">
          ✓ {value.length} Nachweise kombiniert — stärkste Form der Evidenz
          (ISO 19011 § 6.4.7 Abs. 2).
        </p>
      )}
    </div>
  );
}

function MethodEntryCard({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: EditableMethodEntry;
  index: number;
  onChange: (patch: Partial<EditableMethodEntry>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            {methodIcon(entry.method)}
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              #{index + 1} · {methodLabel(entry.method)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-600 p-1"
          aria-label="Nachweis entfernen"
          title="Nachweis entfernen"
        >
          <X size={14} />
        </button>
      </div>

      {/* Gemeinsame Felder: Datum + Notizen */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <label className="text-xs font-medium text-gray-600">Datum</label>
          <Input
            type="date"
            value={entry.date ?? ""}
            onChange={(e) => onChange({ date: e.target.value || undefined })}
            className="text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-gray-600">
            Kurz-Notiz zum Nachweis
          </label>
          <Input
            value={entry.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value || undefined })}
            placeholder="optional — detaillierte Notizen kommen in das Haupt-Notizfeld unten"
            className="text-sm"
          />
        </div>
      </div>

      {/* Methoden-spezifische Felder */}
      {entry.method === "interview" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-600">Person</label>
            <Input
              value={(entry as MethodEntry & { interviewee?: string }).interviewee ?? ""}
              onChange={(e) => onChange({ interviewee: e.target.value || undefined } as Partial<EditableMethodEntry>)}
              placeholder="Max Mustermann"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              Rolle / Funktion
            </label>
            <Input
              value={(entry as MethodEntry & { intervieweeRole?: string }).intervieweeRole ?? ""}
              onChange={(e) => onChange({ intervieweeRole: e.target.value || undefined } as Partial<EditableMethodEntry>)}
              placeholder="z. B. CISO, IT-Leitung"
            />
          </div>
        </div>
      )}

      {entry.method === "document_review" && (
        <DocumentReviewFields entry={entry} onChange={onChange} />
      )}

      {entry.method === "observation" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-600">Ort / Standort</label>
            <Input
              value={(entry as MethodEntry & { location?: string }).location ?? ""}
              onChange={(e) => onChange({ location: e.target.value || undefined } as Partial<EditableMethodEntry>)}
              placeholder="z. B. RZ Frankfurt, Büro Berlin"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              Beobachteter Prozess
            </label>
            <Input
              value={(entry as MethodEntry & { observedProcess?: string }).observedProcess ?? ""}
              onChange={(e) => onChange({ observedProcess: e.target.value || undefined } as Partial<EditableMethodEntry>)}
              placeholder="z. B. Change-Approval-Meeting, Zutritt Serverraum"
            />
          </div>
        </div>
      )}

      {entry.method === "walkthrough" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-600">
              Prozess / Aktivität
            </label>
            <Input
              value={(entry as MethodEntry & { process?: string }).process ?? ""}
              onChange={(e) => onChange({ process: e.target.value || undefined } as Partial<EditableMethodEntry>)}
              placeholder="z. B. Incident-Response Walkthrough"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              Teilnehmer
            </label>
            <Input
              value={(entry as MethodEntry & { participants?: string }).participants ?? ""}
              onChange={(e) => onChange({ participants: e.target.value || undefined } as Partial<EditableMethodEntry>)}
              placeholder="Namen / Rollen, kommagetrennt"
            />
          </div>
        </div>
      )}

      {entry.method === "technical_test" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600">System</label>
              <Input
                value={(entry as MethodEntry & { system?: string }).system ?? ""}
                onChange={(e) => onChange({ system: e.target.value || undefined } as Partial<EditableMethodEntry>)}
                placeholder="z. B. Firewall FW-01, AD-Server dc01"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">
                Testbeschreibung
              </label>
              <Input
                value={(entry as MethodEntry & { testDescription?: string }).testDescription ?? ""}
                onChange={(e) => onChange({ testDescription: e.target.value || undefined } as Partial<EditableMethodEntry>)}
                placeholder="z. B. Rule-Review, Config-Screenshot"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              Test-Ergebnis
            </label>
            <textarea
              value={(entry as MethodEntry & { testResult?: string }).testResult ?? ""}
              onChange={(e) => onChange({ testResult: e.target.value || undefined } as Partial<EditableMethodEntry>)}
              rows={2}
              placeholder="z. B. 12 obsolete Firewall-Regeln gefunden · Audit-Log-Retention: 45 Tage (Soll: 90)"
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
        </div>
      )}

      {entry.method === "sampling" && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-600">
                Population N
              </label>
              <Input
                type="number"
                min={0}
                value={(entry as MethodEntry & { populationSize?: number }).populationSize ?? ""}
                onChange={(e) =>
                  onChange({
                    populationSize: e.target.value
                      ? Math.max(0, parseInt(e.target.value, 10))
                      : undefined,
                  } as Partial<EditableMethodEntry>)
                }
                placeholder="z. B. 500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">
                Stichprobe n
              </label>
              <Input
                type="number"
                min={0}
                value={(entry as MethodEntry & { sampleSize?: number }).sampleSize ?? ""}
                onChange={(e) =>
                  onChange({
                    sampleSize: e.target.value
                      ? Math.max(0, parseInt(e.target.value, 10))
                      : undefined,
                  } as Partial<EditableMethodEntry>)
                }
                placeholder="z. B. 25"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">
                Auswahlverfahren
              </label>
              <Input
                value={(entry as MethodEntry & { selectionMethod?: string }).selectionMethod ?? ""}
                onChange={(e) => onChange({ selectionMethod: e.target.value || undefined } as Partial<EditableMethodEntry>)}
                placeholder="zufällig · geschichtet · risiko-basiert"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              Sample-IDs / Referenzen (kommagetrennt)
            </label>
            <textarea
              value={((entry as MethodEntry & { sampleIds?: string[] }).sampleIds ?? []).join(", ")}
              onChange={(e) => {
                const arr = e.target.value
                  .split(/[,;\n]/)
                  .map((s) => s.trim())
                  .filter(Boolean);
                onChange({ sampleIds: arr.length > 0 ? arr : undefined } as Partial<EditableMethodEntry>);
              }}
              rows={2}
              placeholder="TKT-1234, CHG-9001, USR-42, …"
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm font-mono"
            />
          </div>
        </div>
      )}

      {entry.method === "reperformance" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-600">
              Nachvollzogene Aktivität
            </label>
            <Input
              value={(entry as MethodEntry & { activity?: string }).activity ?? ""}
              onChange={(e) => onChange({ activity: e.target.value || undefined } as Partial<EditableMethodEntry>)}
              placeholder="z. B. Berechtigungs-Review, Backup-Restore-Test"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">
              Baseline / Vergleich
            </label>
            <Input
              value={(entry as MethodEntry & { baseline?: string }).baseline ?? ""}
              onChange={(e) => onChange({ baseline: e.target.value || undefined } as Partial<EditableMethodEntry>)}
              placeholder="z. B. Soll-Prozess aus Policy v3.2"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Dokumentenliste — eigene Unter-Liste innerhalb des Document-Review-Entry.
function DocumentReviewFields({
  entry,
  onChange,
}: {
  entry: EditableMethodEntry;
  onChange: (patch: Partial<EditableMethodEntry>) => void;
}) {
  const docs =
    (entry as MethodEntry & {
      documents?: Array<{ title: string; reference?: string; version?: string }>;
    }).documents ?? [];

  const update = (
    idx: number,
    patch: Partial<{ title: string; reference: string; version: string }>,
  ) => {
    const next = docs.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    onChange({ documents: next } as Partial<EditableMethodEntry>);
  };
  const removeAt = (idx: number) => {
    const next = docs.filter((_, i) => i !== idx);
    onChange({
      documents: next.length > 0 ? next : undefined,
    } as Partial<EditableMethodEntry>);
  };
  const addDoc = () => {
    onChange({
      documents: [...docs, { title: "" }],
    } as Partial<EditableMethodEntry>);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-600">
        Geprüfte Dokumente
      </label>
      {docs.length === 0 && (
        <p className="text-[11px] text-gray-400">
          Noch keine Dokumente — Klick unten hinzufügt eine Zeile.
        </p>
      )}
      {docs.map((d, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_80px_24px] gap-1.5">
          <Input
            value={d.title}
            onChange={(e) => update(i, { title: e.target.value })}
            placeholder="Titel z. B. IT-Security-Richtlinie"
          />
          <Input
            value={d.reference ?? ""}
            onChange={(e) => update(i, { reference: e.target.value })}
            placeholder="Dok-ID / Link"
          />
          <Input
            value={d.version ?? ""}
            onChange={(e) => update(i, { version: e.target.value })}
            placeholder="v3.2"
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="text-gray-400 hover:text-red-600"
            aria-label="Dokument entfernen"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addDoc}
        className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
      >
        <Plus size={12} /> Dokument hinzufügen
      </button>
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
  // Evidenz-IDs, die in der Evaluate-Dialog gerade gepflegt werden —
  // initial aus item.evidenceIds, werden über Add/Remove-Buttons verändert,
  // erst beim Submit als evidenceIds an PUT .../items/[itemId] geschickt.
  const [evaluateEvidenceIds, setEvaluateEvidenceIds] = useState<string[]>([]);
  const [evidencePool, setEvidencePool] = useState<
    Array<{
      id: string;
      fileName: string;
      category: string | null;
      description?: string | null;
      createdAt?: string;
    }>
  >([]);
  const [evidencePickerOpen, setEvidencePickerOpen] = useState(false);
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

  // Evidence-Pool laden (scope: org-weit, damit Auditor alles verknüpfen kann
  // was im Audit-Kontext sinnvoll ist — Kontroll-Tests, bestehende Audit-
  // Evidenzen, Policy-Dokumente usw.)
  const fetchEvidencePool = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/evidence?limit=500&sortDir=desc");
      if (res.ok) {
        const json = await res.json();
        setEvidencePool(json.data ?? []);
      }
    } catch {
      // still usable with empty pool
    }
  }, []);

  useEffect(() => {
    void fetchEvidencePool();
  }, [fetchEvidencePool]);

  // Task-13-Filter über die Items-Tabelle.
  const [resultFilter, setResultFilter] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("");

  // Selektierter Result-Wert + Methoden-Entries-Liste im Dialog.
  // methodEntries: jeder Eintrag ist ein typisierter Nachweis mit eigenen
  // Detail-Feldern (ISO 19011 § 6.4.5/6.4.7).
  const [selectedResult, setSelectedResult] = useState<string>("");
  const [methodEntries, setMethodEntries] = useState<EditableMethodEntry[]>([]);

  // Beim Öffnen der Evaluate-Dialog: Evidenz-Liste + Form-State aus Item
  // ziehen, damit das Dialog den bisherigen Stand anzeigt.
  useEffect(() => {
    if (evaluateItem) {
      const item = evaluateItem as AuditChecklistItem & {
        methodEntries?: MethodEntry[] | null;
      };
      setEvaluateEvidenceIds(item.evidenceIds ?? []);
      setSelectedResult(item.result ?? "");
      // Defensiv kopieren — wir mutieren die Entries-Liste nicht in place,
      // aber die Server-Antwort kann jsonb-Frozen/flat sein.
      setMethodEntries(
        (item.methodEntries ?? []).map((e) => ({ ...e })) as EditableMethodEntry[],
      );
      setEvidencePickerOpen(false);
    } else {
      setEvaluateEvidenceIds([]);
      setSelectedResult("");
      setMethodEntries([]);
    }
  }, [evaluateItem]);

  const handleGenerate = async (
    catalogId?: string,
    implementationGroup?: "ig1" | "ig2" | "ig3",
  ) => {
    setGenerating(true);
    setImportMenuOpen(false);
    try {
      const payload: Record<string, unknown> = {};
      if (catalogId) payload.catalogId = catalogId;
      if (implementationGroup) payload.implementationGroup = implementationGroup;
      const res = await fetch(
        `/api/v1/audit-mgmt/audits/${auditId}/checklists/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (res.ok) {
        // Neu generierte Checkliste direkt selektieren, damit die Items
        // sofort sichtbar werden — sonst müsste der User erst manuell auf
        // den Checklist-Button klicken.
        const json = await res.json().catch(() => null);
        const newId: string | undefined = json?.data?.checklist?.id;
        await fetchChecklists();
        if (newId) {
          setSelectedChecklist(newId);
          void fetchItems(newId);
        }
      } else {
        const j = await res.json().catch(() => ({}));
        alert(
          `Generieren fehlgeschlagen: ${j.error ?? res.statusText} (HTTP ${res.status})`,
        );
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

  const handleEvaluate = async (
    itemId: string,
    formData: FormData,
    evidenceIds: string[],
    entries: EditableMethodEntry[],
  ) => {
    if (!selectedChecklist) return;

    // Nur komplett ausgefüllte Entries an den Server schicken — leere Shells
    // (Entry mit nur method+id, kein einziges ausgefülltes Feld) filtern wir
    // wegen der Zod-Validation defensiv raus. Der User kann sie beim nächsten
    // Öffnen neu anlegen.
    const cleanedEntries = entries
      .map((e) => {
        // Basis-Cleanup: leere Strings auf undefined
        const cleaned: Record<string, unknown> = { id: e.id, method: e.method };
        for (const [k, v] of Object.entries(e)) {
          if (k === "id" || k === "method") continue;
          if (v === "" || v === null || v === undefined) continue;
          if (Array.isArray(v) && v.length === 0) continue;
          cleaned[k] = v;
        }
        return cleaned;
      })
      .filter((e) => Object.keys(e).length > 2 || entries.length > 0);
    // Wenn Einträge bestehen, alle weiterreichen (auch leere Shells sind
    // gültig, weil alle Detail-Felder optional sind) — erst oben gefiltert
    // um `""` → `undefined` zu normalisieren.

    const body: Record<string, unknown> = {
      result: formData.get("result") as string,
      notes: (formData.get("notes") as string) || undefined,
      evidenceIds,
      criterionReference:
        (formData.get("criterionReference") as string) || undefined,
      methodEntries: cleanedEntries.length > 0 ? cleanedEntries : undefined,
      riskRating: (formData.get("riskRating") as string) || undefined,
      correctiveActionSuggestion:
        (formData.get("correctiveActionSuggestion") as string) || undefined,
      remediationDeadline:
        (formData.get("remediationDeadline") as string) || undefined,
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
    } else {
      const j = await res.json().catch(() => ({}));
      alert(
        `Speichern fehlgeschlagen: ${j.error ?? res.statusText} (HTTP ${res.status})`,
      );
    }
  };

  const handleDuplicateChecklist = async (checklistId: string, name: string) => {
    if (
      !confirm(
        `Checkliste "${name}" duplizieren?\n\nEs werden alle Fragen + Kriterien kopiert — OHNE die bereits erfassten Bewertungen und Evidenzen.`,
      )
    )
      return;
    const res = await fetch(
      `/api/v1/audit-mgmt/audits/${auditId}/checklists/${checklistId}/duplicate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const newId: string | undefined = json?.data?.checklist?.id;
      await fetchChecklists();
      if (newId) {
        setSelectedChecklist(newId);
        void fetchItems(newId);
      }
    } else {
      const j = await res.json().catch(() => ({}));
      alert(
        `Duplizieren fehlgeschlagen: ${j.error ?? res.statusText} (HTTP ${res.status})`,
      );
    }
  };

  const handleDeleteChecklist = async (checklistId: string, name: string) => {
    if (
      !confirm(
        `Checkliste "${name}" unwiderruflich löschen?\n\nAlle Fragen und erfassten Bewertungen gehen verloren.\n\nNicht möglich, wenn das Audit bereits abgeschlossen/reported ist.`,
      )
    )
      return;
    const res = await fetch(
      `/api/v1/audit-mgmt/audits/${auditId}/checklists/${checklistId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      if (selectedChecklist === checklistId) {
        setSelectedChecklist(null);
        setItems([]);
      }
      void fetchChecklists();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(
        `Löschen fehlgeschlagen: ${j.error ?? res.statusText} (HTTP ${res.status})`,
      );
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
      case "positive":
        return <CheckCircle2 className="h-4 w-4 text-emerald-700" />;
      case "conforming":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "opportunity_for_improvement":
        return <AlertTriangle className="h-4 w-4 text-blue-500" />;
      case "observation":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "minor_nonconformity":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case "major_nonconformity":
        return <XCircle className="h-4 w-4 text-red-700" />;
      case "nonconforming":
        // Legacy: nach Migration auf minor_nonconformity gemappt, kann aber
        // in Altdaten noch vorkommen.
        return <XCircle className="h-4 w-4 text-red-600" />;
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

  // ── Client-seitige Filter über die Items-Tabelle (Task 13) ──
  // Auditor-Workflow: nur offene Items, nur NC-Items, oder nur Interview-Items
  // anzeigen. Filter wirken additiv (UND-Verknüpfung).
  const filterOnlyOpen = resultFilter === "__open__";
  const filterOnlyNC = resultFilter === "__nc__";
  const displayItems = items.filter((item) => {
    if (filterOnlyOpen && item.result) return false;
    if (
      filterOnlyNC &&
      !(
        item.result === "major_nonconformity" ||
        item.result === "minor_nonconformity" ||
        item.result === "nonconforming"
      )
    )
      return false;
    if (
      resultFilter &&
      !filterOnlyOpen &&
      !filterOnlyNC &&
      item.result !== resultFilter
    )
      return false;
    if (methodFilter) {
      const methods = (
        (item as AuditChecklistItem & { methodEntries?: MethodEntry[] | null })
          .methodEntries ?? []
      ).map((e) => e.method);
      if (!methods.includes(methodFilter as MethodEntry["method"])) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {checklists.map((cl) => (
            <div
              key={cl.id}
              className={`inline-flex items-stretch rounded-md border ${
                selectedChecklist === cl.id
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedChecklist(cl.id)}
                className="px-3 py-1.5 text-sm font-medium"
                title={cl.name}
              >
                {cl.name}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDuplicateChecklist(cl.id, cl.name);
                }}
                className={`border-l px-2 ${
                  selectedChecklist === cl.id
                    ? "border-blue-500 hover:bg-blue-700"
                    : "border-gray-300 hover:bg-blue-50 hover:text-blue-600"
                }`}
                title="Checkliste duplizieren (neue leere Kopie der Fragen)"
                aria-label={`${cl.name} duplizieren`}
              >
                <Copy size={14} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeleteChecklist(cl.id, cl.name);
                }}
                className={`border-l px-2 ${
                  selectedChecklist === cl.id
                    ? "border-blue-500 hover:bg-blue-700"
                    : "border-gray-300 hover:bg-red-50 hover:text-red-600"
                }`}
                title="Checkliste löschen"
                aria-label={`${cl.name} löschen`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {checklists.length === 0 && !loading && (
            <span className="text-sm text-gray-400">
              Noch keine Checklisten. Rechts auf „Generieren" oder
              „Framework-Import" klicken.
            </span>
          )}
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
                    {activeCatalogs.map((cat) => {
                      const isCis = cat.source === "cis_controls_v8";
                      return (
                        <div key={cat.catalogId}>
                          <button
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
                            {isCis && (
                              <span className="text-[10px] text-gray-400 ml-1">
                                · alle Safeguards
                              </span>
                            )}
                          </button>
                          {/* CIS: zusätzlich IG1/IG2/IG3-scoped Generieren */}
                          {isCis && (
                            <div className="pl-6 pb-1 flex gap-1">
                              {(["ig1", "ig2", "ig3"] as const).map((ig) => (
                                <button
                                  key={ig}
                                  type="button"
                                  className="text-[11px] px-2 py-0.5 rounded border border-gray-300 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700"
                                  onClick={() =>
                                    handleGenerate(cat.catalogId, ig)
                                  }
                                  title={
                                    ig === "ig1"
                                      ? "Essential Cyber Hygiene — Baseline für jede Org"
                                      : ig === "ig2"
                                        ? "Risk-Based — umfasst IG1 + zusätzliche Safeguards"
                                        : "Mature Program — umfasst IG1 + IG2 + erweiterte Safeguards"
                                  }
                                >
                                  {ig.toUpperCase()}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
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

          {/* CSV-Export der aktuell selektierten Checkliste (ISO 17021-1 § 9.5
              Arbeitspapier-Archivierung) */}
          {selectedChecklist && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href =
                  `/api/v1/audit-mgmt/audits/${auditId}/checklists/${selectedChecklist}/export?format=csv`;
              }}
              title="Als CSV exportieren (Excel-kompatibel)"
            >
              <Download size={14} className="mr-1" />
              CSV
            </Button>
          )}
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

          {/* Filter-Zeile (Task 13): Result + Methode + Shortcut „nur offene/NC" */}
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs font-semibold text-gray-600">
                Filter:
              </span>
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs"
              >
                <option value="">Alle Bewertungen</option>
                <option value="__open__">↻ Nur offene (unbewertet)</option>
                <option value="__nc__">✗ Nur Abweichungen</option>
                <option value="major_nonconformity">Hauptabweichung</option>
                <option value="minor_nonconformity">Nebenabweichung</option>
                <option value="opportunity_for_improvement">
                  Hinweis / OFI
                </option>
                <option value="observation">Feststellung</option>
                <option value="conforming">Konform</option>
                <option value="positive">Positiv-Bewertung</option>
                <option value="not_applicable">Nicht anwendbar</option>
              </select>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs"
              >
                <option value="">Alle Methoden</option>
                <option value="interview">👤 Interview</option>
                <option value="document_review">📄 Dokumentenprüfung</option>
                <option value="observation">👁 Beobachtung</option>
                <option value="walkthrough">🚶 Walkthrough</option>
                <option value="technical_test">🔧 Tech-Test</option>
                <option value="sampling">🎯 Stichprobe</option>
                <option value="reperformance">🔁 Reperformance</option>
              </select>
              {(resultFilter || methodFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setResultFilter("");
                    setMethodFilter("");
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                >
                  <X size={12} /> Filter zurücksetzen
                </button>
              )}
              <span className="text-xs text-gray-500 ml-auto">
                {displayItems.length} / {items.length}
              </span>
            </div>
          )}

          {/* Items Table */}
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              {t("emptyChecklist")}
            </div>
          ) : displayItems.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              Keine Items passen zum Filter.{" "}
              <button
                type="button"
                onClick={() => {
                  setResultFilter("");
                  setMethodFilter("");
                }}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Filter entfernen
              </button>
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
                  {displayItems.map((item) => {
                    const extItem = item as AuditChecklistItem & {
                      criterionReference?: string | null;
                      methodEntries?: MethodEntry[] | null;
                      riskRating?: string | null;
                      remediationDeadline?: string | null;
                    };
                    const entries = extItem.methodEntries ?? [];
                    const isNC =
                      item.result === "minor_nonconformity" ||
                      item.result === "major_nonconformity" ||
                      item.result === "nonconforming";
                    return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 align-top">
                        {item.sortOrder}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{item.question}</p>
                        {extItem.criterionReference && (
                          <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                            {extItem.criterionReference}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {item.notes}
                          </p>
                        )}
                        {/* Audit-Nachweise kompakt — ein Badge pro Entry,
                            tooltip mit den wichtigsten Detail-Feldern */}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {entries.map((e) => {
                            const details: string[] = [];
                            if (e.method === "interview") {
                              const ie = e as MethodEntry & {
                                interviewee?: string;
                                intervieweeRole?: string;
                              };
                              if (ie.interviewee)
                                details.push(
                                  ie.intervieweeRole
                                    ? `${ie.interviewee} (${ie.intervieweeRole})`
                                    : ie.interviewee,
                                );
                            } else if (e.method === "document_review") {
                              const de = e as MethodEntry & {
                                documents?: Array<{ title: string }>;
                              };
                              if (de.documents && de.documents.length > 0)
                                details.push(
                                  `${de.documents.length} Dok.`,
                                );
                            } else if (e.method === "sampling") {
                              const se = e as MethodEntry & {
                                sampleSize?: number;
                                populationSize?: number;
                              };
                              if (se.sampleSize != null)
                                details.push(
                                  se.populationSize != null
                                    ? `n=${se.sampleSize}/N=${se.populationSize}`
                                    : `n=${se.sampleSize}`,
                                );
                            } else if (e.method === "technical_test") {
                              const te = e as MethodEntry & { system?: string };
                              if (te.system) details.push(te.system);
                            } else if (e.method === "observation") {
                              const oe = e as MethodEntry & { location?: string };
                              if (oe.location) details.push(oe.location);
                            } else if (e.method === "walkthrough") {
                              const we = e as MethodEntry & { process?: string };
                              if (we.process) details.push(we.process);
                            }
                            return (
                              <span
                                key={e.id}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 inline-flex items-center gap-1"
                                title={`${methodLabel(e.method)}${details.length > 0 ? " — " + details.join(" · ") : ""}`}
                              >
                                <span>{methodIcon(e.method)}</span>
                                <span>{methodLabel(e.method)}</span>
                                {details.length > 0 && (
                                  <span className="text-gray-500">
                                    · {details[0]}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                          {extItem.riskRating && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                extItem.riskRating === "critical"
                                  ? "bg-red-100 text-red-800"
                                  : extItem.riskRating === "high"
                                    ? "bg-orange-100 text-orange-800"
                                    : extItem.riskRating === "medium"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-green-100 text-green-800"
                              }`}
                            >
                              Risiko: {extItem.riskRating}
                            </span>
                          )}
                          {extItem.remediationDeadline && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                              Frist: {extItem.remediationDeadline}
                            </span>
                          )}
                          {item.evidenceIds && item.evidenceIds.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                              {item.evidenceIds.length} Evidenz
                              {item.evidenceIds.length === 1 ? "" : "en"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          {resultIcon(item.result)}
                          <span className="text-xs text-gray-700">
                            {resultLabel(item.result)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex gap-1 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEvaluateItem(item)}
                          >
                            {t("evaluate")}
                          </Button>
                          {isNC && (
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Evaluate Dialog — ISO 19011 § 6.4.5/6.4.7 konformes Arbeitspapier */}
      <Dialog open={!!evaluateItem} onOpenChange={() => setEvaluateItem(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit-Bewertung erfassen</DialogTitle>
          </DialogHeader>
          {evaluateItem &&
            (() => {
              const item = evaluateItem as AuditChecklistItem & {
                criterionReference?: string | null;
                methodEntries?: MethodEntry[] | null;
                riskRating?: string | null;
                correctiveActionSuggestion?: string | null;
                remediationDeadline?: string | null;
              };
              const isNC =
                selectedResult === "minor_nonconformity" ||
                selectedResult === "major_nonconformity" ||
                selectedResult === "nonconforming";
              const isObs =
                selectedResult === "observation" ||
                selectedResult === "opportunity_for_improvement";
              return (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleEvaluate(
                  evaluateItem.id,
                  new FormData(e.currentTarget),
                  evaluateEvidenceIds,
                  methodEntries,
                );
              }}
              className="space-y-4"
            >
              {/* Header: Frage + erwartete Evidenz + Kriterium */}
              <div className="rounded-md bg-gray-50 p-3 text-sm space-y-2">
                <p className="text-gray-900 font-medium">
                  {evaluateItem.question}
                </p>
                {evaluateItem.expectedEvidence && (
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Erwartete Evidenz:</span>{" "}
                    {evaluateItem.expectedEvidence}
                  </p>
                )}
              </div>

              {/* Kriterium-Referenz */}
              <div>
                <label className="text-sm font-medium">
                  Audit-Kriterium{" "}
                  <span className="text-xs font-normal text-gray-400">
                    (Norm / Framework-Referenz)
                  </span>
                </label>
                <Input
                  name="criterionReference"
                  defaultValue={item.criterionReference ?? ""}
                  placeholder="z. B. ISO 27001 A.5.1 · CIS v8 06.3 · NIS2 Art. 21(2)(a)"
                />
              </div>

              {/* Bewertung (ISO 19011 § 3.4) */}
              <div>
                <label className="text-sm font-medium">
                  Bewertung{" "}
                  <span className="text-xs font-normal text-gray-400">
                    (ISO 19011 § 3.4 · ISO 17021-1 § 9.4.8)
                  </span>
                </label>
                <select
                  name="result"
                  required
                  value={selectedResult}
                  onChange={(e) => setSelectedResult(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">— Bewertung wählen —</option>
                  <option value="positive">
                    ★ Positiv-Bewertung / Best-Practice
                  </option>
                  <option value="conforming">✓ Konform (keine Abweichung)</option>
                  <option value="opportunity_for_improvement">
                    💡 Hinweis / OFI (Verbesserungspotenzial, nicht bindend)
                  </option>
                  <option value="observation">
                    ⚠ Feststellung / Beobachtung (noch keine Abweichung)
                  </option>
                  <option value="minor_nonconformity">
                    ◆ Nebenabweichung (Minor NC — isolierter Einzelfall)
                  </option>
                  <option value="major_nonconformity">
                    ✗ Hauptabweichung (Major NC — systemisches Versagen)
                  </option>
                  <option value="not_applicable">— Nicht anwendbar (N/A)</option>
                </select>
                {selectedResult && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    {selectedResult === "positive" &&
                      "Umsetzung übertrifft die Anforderung; keine Maßnahme erforderlich."}
                    {selectedResult === "conforming" &&
                      "Kriterium wird erfüllt; keine weitere Aktion."}
                    {selectedResult === "opportunity_for_improvement" &&
                      "Empfehlung des Auditors, nicht zertifizierungsrelevant."}
                    {selectedResult === "observation" &&
                      "Aufmerksamkeitspunkt — könnte ohne Gegensteuern zur Abweichung werden."}
                    {selectedResult === "minor_nonconformity" &&
                      "Einzelne Lücke in der Umsetzung. Korrekturmaßnahme in Standard-Frist (üblicherweise 90 Tage)."}
                    {selectedResult === "major_nonconformity" &&
                      "Systemische Lücke; Zertifikat blockiert bis Nachweis der Korrektur (ISO 17021-1 § 9.4.9)."}
                    {selectedResult === "not_applicable" &&
                      "Kriterium ist für diesen Scope nicht relevant; im Report begründen."}
                  </p>
                )}
              </div>

              {/* Audit-Nachweise (ISO 19011 § 6.4.5/6.4.7) — pro Methode
                  eine typisierte Karte mit eigenen Detail-Feldern */}
              <div>
                <label className="text-sm font-medium">
                  Audit-Nachweise{" "}
                  <span className="text-xs font-normal text-gray-400">
                    (ISO 19011 § 6.4.5/6.4.7 — typisiert, mehrere möglich)
                  </span>
                </label>
                <div className="mt-1">
                  <MethodEntriesEditor
                    value={methodEntries}
                    onChange={setMethodEntries}
                  />
                </div>
              </div>

              {/* Beobachtungen / Auditor-Notizen */}
              <div>
                <label className="text-sm font-medium">
                  Beobachtungen & Auditor-Notizen
                </label>
                <textarea
                  name="notes"
                  defaultValue={evaluateItem.notes ?? ""}
                  rows={4}
                  placeholder="Konkrete Feststellungen, geprüfte Dokumente/Systeme, Zitate aus Interview, Screenshots, Begründung der Bewertung, …"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                />
              </div>

              {/* Risiko + Korrekturmaßnahme — nur bei NC/Observation/OFI */}
              {(isNC || isObs) && (
                <fieldset className="border border-orange-200 bg-orange-50/30 rounded-md p-3 space-y-3">
                  <legend className="text-xs font-semibold text-orange-700 px-1">
                    {isNC
                      ? "Abweichungs-Behandlung (ISO 27001 § 10.1 · ISO 9001 § 10.2)"
                      : "Aufmerksamkeits-/Verbesserungs-Hinweis"}
                  </legend>

                  <div>
                    <label className="text-sm font-medium">
                      Risikobewertung der Abweichung{" "}
                      <span className="text-xs font-normal text-gray-400">
                        (ISO 31000 § 6.4.3)
                      </span>
                    </label>
                    <select
                      name="riskRating"
                      defaultValue={item.riskRating ?? ""}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">— Risiko einstufen —</option>
                      <option value="low">Niedrig</option>
                      <option value="medium">Mittel</option>
                      <option value="high">Hoch</option>
                      <option value="critical">Kritisch</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Vorgeschlagene Korrekturmaßnahme
                    </label>
                    <textarea
                      name="correctiveActionSuggestion"
                      defaultValue={item.correctiveActionSuggestion ?? ""}
                      rows={3}
                      placeholder={
                        isNC
                          ? "Konkret: wer macht was bis wann? Welche Wirksamkeits-Prüfung folgt?"
                          : "Empfehlung zur Verbesserung — der Org bleibt die Umsetzung freigestellt."
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>

                  {isNC && (
                    <div>
                      <label className="text-sm font-medium">
                        Frist zur Umsetzung{" "}
                        <span className="text-xs font-normal text-gray-400">
                          (Minor: üblicherweise 90 Tage · Major: vor Rezertifizierung)
                        </span>
                      </label>
                      <Input
                        name="remediationDeadline"
                        type="date"
                        defaultValue={item.remediationDeadline ?? ""}
                      />
                    </div>
                  )}
                </fieldset>
              )}

              {/* Evidenz-Verknüpfung */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Evidenzen{" "}
                    <span className="text-xs font-normal text-gray-500">
                      ({evaluateEvidenceIds.length})
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setEvidencePickerOpen((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <Paperclip size={12} />
                    {evidencePickerOpen ? "Schließen" : "Evidenz hinzufügen"}
                  </button>
                </div>

                {/* Bereits verknüpfte Evidenzen als Chips mit X-Button */}
                <div className="mt-2 flex flex-wrap gap-1.5 min-h-[32px] rounded-md border border-dashed border-gray-200 p-2">
                  {evaluateEvidenceIds.length === 0 && (
                    <span className="text-xs text-gray-400">
                      Keine Evidenzen verknüpft. Klicke oben auf „Evidenz
                      hinzufügen" um aus dem Evidenz-Pool zu wählen.
                    </span>
                  )}
                  {evaluateEvidenceIds.map((id) => {
                    const ev = evidencePool.find((e) => e.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 border border-blue-200"
                      >
                        <Paperclip size={10} />
                        <span className="max-w-[180px] truncate" title={ev?.fileName ?? id}>
                          {ev?.fileName ?? id.slice(0, 8)}
                        </span>
                        {ev?.category && (
                          <span className="text-[10px] text-blue-500">
                            · {ev.category}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setEvaluateEvidenceIds((ids) =>
                              ids.filter((x) => x !== id),
                            )
                          }
                          className="ml-0.5 hover:text-red-600"
                          aria-label="Entfernen"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    );
                  })}
                </div>

                {/* Picker: scroll-baren Auszug aus dem Pool */}
                {evidencePickerOpen && (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-gray-200">
                    {evidencePool.length === 0 && (
                      <div className="p-3 text-xs text-gray-400">
                        Noch keine Evidenzen in der Org angelegt. Erstelle erst
                        Evidenzen unter <em>/ics/evidence</em> oder importiere
                        sie aus einem Kontroll-Test.
                      </div>
                    )}
                    {evidencePool
                      .filter((e) => !evaluateEvidenceIds.includes(e.id))
                      .slice(0, 100)
                      .map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => {
                            setEvaluateEvidenceIds((ids) => [...ids, ev.id]);
                          }}
                          className="block w-full text-left px-3 py-2 text-xs border-b border-gray-100 last:border-0 hover:bg-blue-50"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-gray-900 truncate">
                              {ev.fileName}
                            </span>
                            {ev.category && (
                              <span className="text-[10px] text-gray-500 shrink-0">
                                {ev.category}
                              </span>
                            )}
                          </div>
                          {ev.description && (
                            <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                              {ev.description}
                            </p>
                          )}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEvaluateItem(null)}
                >
                  Abbrechen
                </Button>
                <Button type="submit">{t("save")}</Button>
              </div>
            </form>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Create Finding Dialog */}
      <Dialog
        open={!!createFindingItem}
        onOpenChange={() => setCreateFindingItem(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("createFinding")}</DialogTitle>
          </DialogHeader>
          {createFindingItem &&
            (() => {
              // Auto-Prefill aus dem Checklist-Item:
              //  • Severity via Result-Mapping (ISO 19011)
              //  • Title aus Kriterium + Frage-Kurzform
              //  • Description aus Notes + Korrekturmaßnahmen-Vorschlag
              //  • Remediation-Due aus remediationDeadline
              const cfItem = createFindingItem as AuditChecklistItem & {
                criterionReference?: string | null;
                correctiveActionSuggestion?: string | null;
                remediationDeadline?: string | null;
              };
              const prefillSeverity =
                checklistResultToFindingSeverity(cfItem.result) ??
                "minor_nonconformity";
              const prefillTitle = cfItem.criterionReference
                ? `${cfItem.criterionReference} — ${cfItem.question.slice(0, 120)}`
                : cfItem.question.slice(0, 160);
              const prefillDescription = [
                cfItem.notes,
                cfItem.correctiveActionSuggestion
                  ? `\nVorschlag Korrekturmaßnahme:\n${cfItem.correctiveActionSuggestion}`
                  : "",
              ]
                .filter(Boolean)
                .join("");
              return (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleCreateFinding(
                      cfItem.id,
                      new FormData(e.currentTarget),
                    );
                  }}
                  className="space-y-4"
                >
                  {/* Kontext-Box: zeigt Bewertung + Kriterium aus Checklist-Item */}
                  <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
                    <p className="font-semibold">
                      Auto-Prefill aus Checklist-Bewertung
                    </p>
                    <p className="mt-1">
                      Bewertung: <strong>{resultLabel(cfItem.result)}</strong>
                      {cfItem.criterionReference && (
                        <>
                          {" · "}Kriterium:{" "}
                          <code className="font-mono">
                            {cfItem.criterionReference}
                          </code>
                        </>
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      {t("findingTitle")}
                    </label>
                    <Input
                      name="title"
                      required
                      defaultValue={prefillTitle}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      {t("description")}
                    </label>
                    <textarea
                      name="description"
                      rows={5}
                      defaultValue={prefillDescription}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      {t("findingSeverity")}{" "}
                      <span className="text-xs font-normal text-gray-400">
                        (ISO 19011 § 3.4)
                      </span>
                    </label>
                    <select
                      name="severity"
                      required
                      defaultValue={prefillSeverity}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="major_nonconformity">
                        ✗ Hauptabweichung (Major NC)
                      </option>
                      <option value="minor_nonconformity">
                        ◆ Nebenabweichung (Minor NC)
                      </option>
                      <option value="opportunity_for_improvement">
                        💡 Hinweis / OFI
                      </option>
                      <option value="observation">⚠ Feststellung</option>
                      <option value="recommendation">📌 Empfehlung</option>
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
                      Bei Verknüpfung wird die Feststellung als
                      Wirksamkeitsnachweis für das Risiko geführt — ein
                      Maßnahmen-Plan kann per Sync als Risk-Treatment
                      übernommen werden.
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      {t("remediationDueDate")}
                    </label>
                    <Input
                      name="remediationDueDate"
                      type="date"
                      defaultValue={cfItem.remediationDeadline ?? ""}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateFindingItem(null)}
                    >
                      Abbrechen
                    </Button>
                    <Button type="submit">{t("save")}</Button>
                  </div>
                </form>
              );
            })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Activities Tab ──────────────────────────────────────────

// Typisierte Activity-Templates für typische Audit-Phasen nach IIA 2330 /
// ISO 19011 § 6.4: Opening/Closing Meeting + Field-Work-Typen. Das Dialog
// kann per Quick-Button vorbelegt werden — schneller als alles manuell.
type ActivityTemplate = {
  key: string;
  activityType: string;
  titleDe: string;
  icon: string;
  description?: string;
  defaultDurationMinutes?: number;
};
const ACTIVITY_TEMPLATES: ActivityTemplate[] = [
  {
    key: "opening",
    activityType: "meeting",
    titleDe: "Eröffnungsgespräch",
    icon: "🚪",
    description:
      "Audit-Start mit Auditee: Ziele, Scope, Kriterien, Kommunikationsplan (ISO 19011 § 6.4.2).",
    defaultDurationMinutes: 60,
  },
  {
    key: "closing",
    activityType: "meeting",
    titleDe: "Abschlussgespräch",
    icon: "🏁",
    description:
      "Zusammenfassung der Feststellungen, Klärung offener Punkte (ISO 19011 § 6.4.10).",
    defaultDurationMinutes: 60,
  },
  {
    key: "interview",
    activityType: "interview",
    titleDe: "Field-Interview",
    icon: "👤",
    description: "Befragung mit Prozess-Eigner / Verantwortlichem.",
    defaultDurationMinutes: 45,
  },
  {
    key: "docreview",
    activityType: "document_review",
    titleDe: "Dokumentenprüfung",
    icon: "📄",
    description: "Review von Richtlinien, Protokollen, Berichten.",
    defaultDurationMinutes: 30,
  },
  {
    key: "walkthrough",
    activityType: "walkthrough",
    titleDe: "Walkthrough",
    icon: "🚶",
    description: "Prozess-Durchlauf mit Prozess-Eigner.",
    defaultDurationMinutes: 45,
  },
  {
    key: "testing",
    activityType: "testing",
    titleDe: "Technischer Test",
    icon: "🔧",
    description: "Config-Prüfung, Sample-Test, Log-Analyse.",
    defaultDurationMinutes: 30,
  },
];

type ActivityWithUser = AuditActivity & { performedByName?: string | null };

function ActivitiesTab({ auditId }: { auditId: string }) {
  const t = useTranslations("auditMgmt");
  const [activities, setActivities] = useState<ActivityWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("");
  const [presetValues, setPresetValues] = useState<ActivityTemplate | null>(
    null,
  );

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/audit-mgmt/audits/${auditId}/activities?limit=200`,
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
      setPresetValues(null);
      void fetchActivities();
    }
  };

  const openWithPreset = (tpl: ActivityTemplate) => {
    setPresetValues(tpl);
    setDialogOpen(true);
  };

  // Summary-Statistiken
  const totalActivities = activities.length;
  const totalDurationMin = activities.reduce(
    (sum, a) => sum + (a.duration ?? 0),
    0,
  );
  const byType: Record<string, number> = {};
  for (const a of activities) {
    byType[a.activityType] = (byType[a.activityType] ?? 0) + 1;
  }

  const filteredActivities = filterType
    ? activities.filter((a) => a.activityType === filterType)
    : activities;

  // Nach Datum gruppieren (Key: YYYY-MM-DD)
  const byDay = new Map<string, ActivityWithUser[]>();
  for (const a of filteredActivities) {
    const day = new Date(a.performedAt).toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(a);
  }
  const sortedDays = Array.from(byDay.keys()).sort().reverse();

  const iconForType = (t: string): string => {
    switch (t) {
      case "meeting":
        return "🗓";
      case "interview":
        return "👤";
      case "document_review":
        return "📄";
      case "walkthrough":
        return "🚶";
      case "testing":
        return "🔧";
      default:
        return "•";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + Quick-Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold text-gray-900">
          {t("activityLog")}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm rounded-md border border-gray-300 px-2 py-1"
          >
            <option value="">Alle Typen</option>
            {Object.keys(byType).map((k) => (
              <option key={k} value={k}>
                {t(`activityTypes.${k === "document_review" ? "documentReview" : k}`, { defaultValue: k })}{" "}
                ({byType[k]})
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={() => {
              setPresetValues(null);
              setDialogOpen(true);
            }}
          >
            <Plus size={14} className="mr-1" />
            {t("addActivity")}
          </Button>
        </div>
      </div>

      {/* Summary-Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label="Aktivitäten" value={totalActivities} />
        <StatCard
          label="Dauer gesamt"
          value={
            totalDurationMin > 0
              ? `${Math.floor(totalDurationMin / 60)}h ${totalDurationMin % 60}min`
              : "—"
          }
        />
        <StatCard
          label="Meetings"
          value={byType.meeting ?? 0}
          color="bg-purple-50 text-purple-900"
        />
        <StatCard
          label="Interviews"
          value={byType.interview ?? 0}
          color="bg-indigo-50 text-indigo-900"
        />
      </div>

      {/* Quick-Templates (IIA 2330 / ISO 19011 § 6.4) */}
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs font-semibold text-gray-600 mb-2">
          Schnell-Templates
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITY_TEMPLATES.map((tpl) => (
            <button
              key={tpl.key}
              type="button"
              onClick={() => openWithPreset(tpl)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-xs hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700"
              title={tpl.description}
            >
              <span>{tpl.icon}</span>
              <span>{tpl.titleDe}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dialog — mit Preset-Unterstützung */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setPresetValues(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {presetValues
                ? `${presetValues.icon} ${presetValues.titleDe}`
                : t("addActivity")}
            </DialogTitle>
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
              <select
                name="activityType"
                required
                defaultValue={presetValues?.activityType ?? "interview"}
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
              <Input
                name="title"
                required
                defaultValue={presetValues?.titleDe ?? ""}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t("description")}</label>
              <Input
                name="description"
                defaultValue={presetValues?.description ?? ""}
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                {t("durationMinutes")}
              </label>
              <Input
                name="duration"
                type="number"
                min="1"
                defaultValue={presetValues?.defaultDurationMinutes ?? ""}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t("notes")}</label>
              <textarea
                name="notes"
                rows={3}
                placeholder="Teilnehmer, Themen, Beobachtungen, offene Punkte, …"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
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

      {/* Timeline (gruppiert nach Tag) */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          {filterType
            ? `Keine Aktivitäten vom Typ "${filterType}" erfasst.`
            : t("emptyActivities")}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDays.map((day) => {
            const dayActivities = byDay.get(day)!;
            const dayDuration = dayActivities.reduce(
              (sum, a) => sum + (a.duration ?? 0),
              0,
            );
            return (
              <div key={day} className="space-y-2">
                <div className="flex items-center gap-2 sticky top-0 bg-gray-50 -mx-1 px-2 py-1 rounded border-l-4 border-blue-500">
                  <span className="text-xs font-semibold text-gray-700">
                    {new Date(day).toLocaleDateString("de-DE", {
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {dayActivities.length} Aktivität
                    {dayActivities.length === 1 ? "" : "en"}
                    {dayDuration > 0 && (
                      <>
                        {" · "}
                        {Math.floor(dayDuration / 60)}h {dayDuration % 60}min
                      </>
                    )}
                  </span>
                </div>
                <div className="space-y-2 pl-2">
                  {dayActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="rounded-md border border-gray-200 bg-white p-3"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span aria-hidden className="text-base">
                            {iconForType(activity.activityType)}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {activity.activityType}
                          </Badge>
                          <span className="font-medium text-gray-900 text-sm">
                            {activity.title}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-500">
                          {new Date(activity.performedAt).toLocaleTimeString(
                            "de-DE",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                          {activity.duration
                            ? ` · ${activity.duration} min`
                            : ""}
                          {activity.performedByName && (
                            <> · {activity.performedByName}</>
                          )}
                        </span>
                      </div>
                      {activity.description && (
                        <p className="text-xs text-gray-600 mt-1">
                          {activity.description}
                        </p>
                      )}
                      {activity.notes && (
                        <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">
                          {activity.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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

  const [bulkCreating, setBulkCreating] = useState(false);
  const handleBulkCreate = async () => {
    if (
      !confirm(
        "Für jede NC-Bewertung ohne Finding automatisch ein Finding anlegen?\n\n" +
          "• Severity wird aus der Bewertung abgeleitet\n" +
          "• Title aus Kriterium + Frage\n" +
          "• Beschreibung aus Notes + Korrekturmaßnahmen-Vorschlag\n" +
          "• Duplikate (gleicher Titel) werden übersprungen",
      )
    )
      return;
    setBulkCreating(true);
    try {
      const res = await fetch(
        `/api/v1/audit-mgmt/audits/${auditId}/bulk-create-findings`,
        { method: "POST" },
      );
      if (res.ok) {
        const j = await res.json();
        alert(
          `Bulk-Erstellung abgeschlossen:\n${j.data.created} neu, ${j.data.skipped} übersprungen (Duplikat), ${j.data.total} total.`,
        );
        await fetchFindings();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(`Fehler: ${j.error ?? res.statusText}`);
      }
    } finally {
      setBulkCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold text-gray-900">
          {t("findingsForAudit")}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkCreate}
            disabled={bulkCreating}
            title="Für jede NC-Bewertung ohne Finding automatisch eins anlegen (ISO 19011 § 6.4.8)"
          >
            {bulkCreating ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <Sparkles size={14} className="mr-1" />
            )}
            Alle NC → Findings
          </Button>
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
    positive: number;
    conforming: number;
    opportunity_for_improvement: number;
    observation: number;
    minor_nonconformity: number;
    major_nonconformity: number;
    nonconforming: number;
    not_applicable: number;
    unevaluated: number;
  }>;
  remediationTimeline?: {
    overdue: number;
    dueSoon: number;
    onTrack: number;
    noDeadline: number;
  };
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
    result?: string | null;
    notes: string | null;
    criterionReference?: string | null;
    riskRating?: string | null;
    correctiveActionSuggestion?: string | null;
    remediationDeadline?: string | null;
    methodEntries?: MethodEntry[] | null;
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

  // ISO 19011 § 3.4 Farbskala inkl. Legacy-Synonymen.
  const sevColors: Record<string, string> = {
    major_nonconformity: "bg-red-100 text-red-900 border-red-200",
    significant_nonconformity: "bg-red-100 text-red-900 border-red-200",
    minor_nonconformity: "bg-orange-100 text-orange-900 border-orange-200",
    insignificant_nonconformity:
      "bg-orange-100 text-orange-900 border-orange-200",
    opportunity_for_improvement:
      "bg-yellow-100 text-yellow-900 border-yellow-200",
    improvement_requirement: "bg-yellow-100 text-yellow-900 border-yellow-200",
    observation: "bg-blue-100 text-blue-900 border-blue-200",
    recommendation: "bg-gray-100 text-gray-800 border-gray-200",
    positive: "bg-emerald-100 text-emerald-900 border-emerald-200",
    conforming: "bg-green-100 text-green-900 border-green-200",
  };
  const sevLabels: Record<string, string> = {
    major_nonconformity: "Hauptabweichung",
    significant_nonconformity: "Wesentliche Abweichung (Legacy)",
    minor_nonconformity: "Nebenabweichung",
    insignificant_nonconformity: "Geringfügige Abweichung (Legacy)",
    opportunity_for_improvement: "Hinweis / OFI",
    improvement_requirement: "Verbesserungsanforderung (Legacy)",
    observation: "Feststellung / Beobachtung",
    recommendation: "Empfehlung",
    positive: "Positiv-Bewertung",
    conforming: "Konform",
  };

  const sumBreakdown = (
    key: keyof ReportData["breakdown"][number],
  ): number =>
    report.breakdown.reduce(
      (sum, b) => sum + (typeof b[key] === "number" ? (b[key] as number) : 0),
      0,
    );

  const totalMajor = sumBreakdown("major_nonconformity");
  const totalMinor = sumBreakdown("minor_nonconformity");
  const totalOfi = sumBreakdown("opportunity_for_improvement");
  const totalObservation = sumBreakdown("observation");
  const totalPositive = sumBreakdown("positive");
  const totalConforming = sumBreakdown("conforming");
  const totalNA = sumBreakdown("not_applicable");
  const totalUnevaluated = sumBreakdown("unevaluated");
  // Legacy-nonconforming: im Report als "Abweichung" — zusätzlich zu major/minor.
  const totalLegacyNonconforming = sumBreakdown("nonconforming");

  const totalEvaluated =
    totalPositive +
    totalConforming +
    totalOfi +
    totalObservation +
    totalMinor +
    totalMajor +
    totalLegacyNonconforming +
    totalNA;
  const totalItems = totalEvaluated + totalUnevaluated;
  const conformanceRate =
    totalEvaluated > 0
      ? Math.round(
          ((totalPositive + totalConforming) / totalEvaluated) * 100,
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

      {/* Checklist Conformance — 7-stufige ISO-19011-Aufschlüsselung */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Checklisten-Auswertung{" "}
          <span className="text-xs font-normal text-gray-500">
            (ISO 19011 § 3.4)
          </span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {totalMajor > 0 && (
            <StatCard
              label="Hauptabweichung"
              value={totalMajor}
              color="bg-red-50 text-red-900 border border-red-200"
            />
          )}
          {totalMinor > 0 && (
            <StatCard
              label="Nebenabweichung"
              value={totalMinor}
              color="bg-orange-50 text-orange-900 border border-orange-200"
            />
          )}
          {totalOfi > 0 && (
            <StatCard
              label="Hinweis (OFI)"
              value={totalOfi}
              color="bg-yellow-50 text-yellow-900 border border-yellow-200"
            />
          )}
          {totalObservation > 0 && (
            <StatCard
              label="Feststellung"
              value={totalObservation}
              color="bg-blue-50 text-blue-900 border border-blue-200"
            />
          )}
          {totalPositive > 0 && (
            <StatCard
              label="Positiv"
              value={totalPositive}
              color="bg-emerald-50 text-emerald-900 border border-emerald-200"
            />
          )}
          <StatCard
            label="Konform"
            value={totalConforming}
            color="bg-green-50 text-green-900"
          />
          {totalLegacyNonconforming > 0 && (
            <StatCard
              label="Abweichung (Legacy)"
              value={totalLegacyNonconforming}
              color="bg-red-50/60 text-red-800 border border-dashed border-red-200"
            />
          )}
          <StatCard
            label="Nicht anwendbar"
            value={totalNA}
            color="bg-gray-50 text-gray-800"
          />
          {totalUnevaluated > 0 && (
            <StatCard
              label="Unbewertet"
              value={totalUnevaluated}
              color="bg-yellow-50 text-yellow-900"
            />
          )}
        </div>
        <div className="pt-2 text-xs text-gray-500">
          Konformitätsgrad (positiv + konform / bewertet):{" "}
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

        {/* Remediation-Timeline — aus API seit 0293 */}
        {report.remediationTimeline && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">
              Korrektur-Timeline (Fristen aus NC-Bewertungen)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatCard
                label="Überfällig"
                value={report.remediationTimeline.overdue}
                color="bg-red-100 text-red-900 border border-red-200"
              />
              <StatCard
                label="Fällig ≤ 30 Tage"
                value={report.remediationTimeline.dueSoon}
                color="bg-orange-50 text-orange-900 border border-orange-200"
              />
              <StatCard
                label="In Plan"
                value={report.remediationTimeline.onTrack}
                color="bg-green-50 text-green-900"
              />
              <StatCard
                label="Keine Frist"
                value={report.remediationTimeline.noDeadline}
                color="bg-gray-50 text-gray-700"
              />
            </div>
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
  color = "bg-gray-50 text-gray-800",
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className={`rounded-md p-3 ${color}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

// ─── Finding Row (with inline Treatment Plan editor) ─────────

// ISO-konforme Status-Transitions laut VALID_FINDING_TRANSITIONS aus
// @grc/shared. Lokal spiegeln wir nur die "vorwärts" + "rückwärts" für die
// UI-Buttons — der Server validiert die volle Transition-Matrix.
const FINDING_NEXT_STATUS: Record<string, Array<{ status: string; label: string; variant: "primary" | "secondary" | "danger" }>> = {
  identified: [
    { status: "in_remediation", label: "In Behebung", variant: "primary" },
    { status: "accepted", label: "Akzeptieren", variant: "secondary" },
    { status: "closed", label: "Schließen", variant: "secondary" },
  ],
  in_remediation: [
    { status: "remediated", label: "Behoben", variant: "primary" },
  ],
  remediated: [
    { status: "verified", label: "Verifiziert", variant: "primary" },
    { status: "in_remediation", label: "Zurück zu Behebung", variant: "secondary" },
  ],
  verified: [
    { status: "closed", label: "Schließen", variant: "primary" },
  ],
  accepted: [
    { status: "closed", label: "Schließen", variant: "primary" },
  ],
  closed: [],
};

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
  const [transitioning, setTransitioning] = useState(false);
  const [plan, setPlan] = useState(finding.remediationPlan ?? "");
  const [due, setDue] = useState(finding.remediationDueDate ?? "");

  const nextStatuses = FINDING_NEXT_STATUS[finding.status] ?? [];

  const transitionTo = async (newStatus: string) => {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/v1/findings/${finding.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        onUpdated();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(
          `Statuswechsel fehlgeschlagen: ${j.error ?? res.statusText}`,
        );
      }
    } finally {
      setTransitioning(false);
    }
  };
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

  // Überfälligkeits-Marker: Finding hat eine Frist, die in der Vergangenheit
  // liegt UND Status ist noch offen. Rot-Pill im Header.
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue =
    finding.remediationDueDate != null &&
    finding.remediationDueDate < today &&
    (finding.status === "identified" ||
      finding.status === "in_remediation");
  const isDueSoon =
    !isOverdue &&
    finding.remediationDueDate != null &&
    (finding.status === "identified" ||
      finding.status === "in_remediation") &&
    (() => {
      const delta =
        (new Date(finding.remediationDueDate).getTime() -
          new Date(today).getTime()) /
        86400000;
      return delta >= 0 && delta <= 14;
    })();

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
            {isOverdue && (
              <span
                className="inline-block text-[10px] px-2 py-0.5 rounded-full border bg-red-100 border-red-300 text-red-900 animate-pulse"
                title={`Frist ${finding.remediationDueDate} — bereits überschritten`}
              >
                ⚠ Überfällig
              </span>
            )}
            {isDueSoon && (
              <span
                className="inline-block text-[10px] px-2 py-0.5 rounded-full border bg-amber-50 border-amber-300 text-amber-900"
                title={`Frist ${finding.remediationDueDate} — in ≤14 Tagen`}
              >
                ⏰ Fällig ≤14 Tage
              </span>
            )}
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
          <div className="flex flex-wrap items-center gap-1.5 print:hidden">
            {/* Status-Transition-Buttons nach ISO 19011 Follow-up */}
            {nextStatuses.map((next) => (
              <Button
                key={next.status}
                size="sm"
                variant={next.variant === "primary" ? "default" : "outline"}
                disabled={transitioning}
                onClick={() => void transitionTo(next.status)}
                title={`Status → ${next.label}`}
              >
                {next.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              {finding.remediationPlan
                ? "Maßnahme bearbeiten"
                : "Maßnahme erfassen"}
            </Button>
          </div>
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
