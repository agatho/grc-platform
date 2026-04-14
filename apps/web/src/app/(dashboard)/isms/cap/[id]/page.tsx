"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2, ArrowLeft, AlertTriangle, CheckCircle, Clock,
  ClipboardList, Wrench, ShieldCheck, FileSearch,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ── Types ── */

interface CorrectiveAction {
  id: string;
  title: string;
  description: string | null;
  action_type: string;
  assigned_to_name: string | null;
  due_date: string | null;
  completed_at: string | null;
  verification_required: boolean;
  verified_by_name: string | null;
  verified_at: string | null;
  verification_result: string | null;
  verification_notes: string | null;
  effectiveness_review_date: string | null;
  effectiveness_rating: string | null;
  effectiveness_notes: string | null;
  status: string;
}

interface NonconformityDetail {
  id: string;
  nc_code: string;
  title: string;
  description: string | null;
  source_type: string;
  severity: string;
  category: string | null;
  iso_clause: string | null;
  identified_at: string;
  due_date: string | null;
  closed_at: string | null;
  identified_by_name: string | null;
  assigned_to_name: string | null;
  root_cause: string | null;
  root_cause_method: string | null;
  status: string;
  tags: string[];
  corrective_actions: CorrectiveAction[];
}

/* ── Label Maps (German) ── */

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-900",
  analysis: "bg-orange-100 text-orange-900",
  action_planned: "bg-yellow-100 text-yellow-900",
  in_progress: "bg-blue-100 text-blue-900",
  verification: "bg-purple-100 text-purple-900",
  closed: "bg-green-100 text-green-900",
  reopened: "bg-red-100 text-red-900",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Offen",
  analysis: "Analyse",
  action_planned: "Maßnahme geplant",
  in_progress: "In Bearbeitung",
  verification: "Verifizierung",
  closed: "Geschlossen",
  reopened: "Wiedereröffnet",
};

const SEVERITY_COLORS: Record<string, string> = {
  major: "bg-red-100 text-red-900",
  minor: "bg-yellow-100 text-yellow-900",
  observation: "bg-blue-100 text-blue-900",
};

const SEVERITY_LABELS: Record<string, string> = {
  major: "Wesentlich",
  minor: "Geringfügig",
  observation: "Beobachtung",
};

const SOURCE_LABELS: Record<string, string> = {
  internal_audit: "Internes Audit",
  management_review: "Management Review",
  incident: "Sicherheitsvorfall",
  assessment: "ISMS-Bewertung",
  external_audit: "Externes Audit",
  complaint: "Beschwerde",
};

const ROOT_CAUSE_LABELS: Record<string, string> = {
  five_why: "5-Why-Analyse",
  ishikawa: "Ishikawa-Diagramm",
  fault_tree: "Fehlerbaumanalyse",
  pareto: "Pareto-Analyse",
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  corrective: "Korrektur",
  preventive: "Vorbeugend",
  containment: "Sofortmaßnahme",
};

const CA_STATUS_COLORS: Record<string, string> = {
  planned: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-900",
  completed: "bg-green-100 text-green-900",
  verified: "bg-teal-100 text-teal-900",
  ineffective: "bg-red-100 text-red-900",
};

const CA_STATUS_LABELS: Record<string, string> = {
  planned: "Geplant",
  in_progress: "In Bearbeitung",
  completed: "Abgeschlossen",
  verified: "Verifiziert",
  ineffective: "Unwirksam",
};

/* ── Helpers ── */

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === "closed") return false;
  return new Date(dueDate) < new Date();
}

/* ── Component ── */

export default function IsmsCapDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <CapDetailInner />
    </ModuleGate>
  );
}

function CapDetailInner() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<NonconformityDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/isms/nonconformities/${id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-gray-500 py-12">Nichtkonformität nicht gefunden.</p>;
  }

  const actions = data.corrective_actions ?? [];
  const completedActions = actions.filter((a) => a.status === "completed" || a.status === "verified");
  const overdue = isOverdue(data.due_date, data.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/isms/cap")}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-500">{data.nc_code}</span>
              <h1 className="text-2xl font-bold text-gray-900">{data.title}</h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={SEVERITY_COLORS[data.severity] ?? "bg-gray-100"}>
                {SEVERITY_LABELS[data.severity] ?? data.severity}
              </Badge>
              <Badge className={STATUS_COLORS[data.status] ?? "bg-gray-100"}>
                {STATUS_LABELS[data.status] ?? data.status}
              </Badge>
              {overdue && (
                <Badge className="bg-red-600 text-white">
                  <Clock size={10} className="mr-1" /> Überfällig
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Beschreibung */}
      {data.description && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-2">
            <FileSearch size={14} /> Beschreibung
          </h2>
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{data.description}</p>
        </div>
      )}

      {/* Stammdaten */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 flex items-center gap-2">
          <ClipboardList size={14} /> Stammdaten
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FieldRow label="Quelle" value={SOURCE_LABELS[data.source_type] ?? data.source_type} />
          <FieldRow label="Schweregrad" value={SEVERITY_LABELS[data.severity] ?? data.severity} />
          <FieldRow label="ISO-Klausel" value={data.iso_clause ?? "—"} />
          <FieldRow label="Erkannt am" value={fmtDate(data.identified_at)} />
          <FieldRow label="Frist" value={fmtDate(data.due_date)} highlight={overdue} />
          <FieldRow label="Geschlossen am" value={fmtDate(data.closed_at)} />
          <FieldRow label="Erkannt von" value={data.identified_by_name ?? "—"} />
          <FieldRow label="Zugewiesen an" value={data.assigned_to_name ?? "—"} />
          <FieldRow label="Kategorie" value={data.category ?? "—"} />
        </div>
      </div>

      {/* Ursachenanalyse */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 flex items-center gap-2">
          <AlertTriangle size={14} /> Ursachenanalyse
        </h2>
        {data.root_cause ? (
          <div className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">Methode</dt>
              <dd className="text-sm text-gray-900 mt-0.5">
                {ROOT_CAUSE_LABELS[data.root_cause_method ?? ""] ?? data.root_cause_method ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Grundursache</dt>
              <dd className="text-sm text-gray-800 whitespace-pre-wrap mt-0.5">{data.root_cause}</dd>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            Noch keine Ursachenanalyse durchgeführt.
          </p>
        )}
      </div>

      {/* Korrekturmaßnahmen */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <Wrench size={14} /> Korrekturmaßnahmen
          </h2>
          <span className="text-sm text-gray-500">
            {completedActions.length}/{actions.length} abgeschlossen
          </span>
        </div>

        {actions.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Keine Korrekturmaßnahmen erfasst.</p>
        ) : (
          <div className="space-y-4">
            {actions.map((action) => {
              const caOverdue = isOverdue(action.due_date, action.status);
              return (
                <div
                  key={action.id}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">{action.title}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {ACTION_TYPE_LABELS[action.action_type] ?? action.action_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {caOverdue && (
                        <Badge className="bg-red-600 text-white text-[10px]">
                          <Clock size={8} className="mr-0.5" /> Überfällig
                        </Badge>
                      )}
                      <Badge className={CA_STATUS_COLORS[action.status] ?? "bg-gray-100"}>
                        {CA_STATUS_LABELS[action.status] ?? action.status}
                      </Badge>
                    </div>
                  </div>

                  {action.description && (
                    <p className="text-sm text-gray-600">{action.description}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-500">Zugewiesen an</span>
                      <p className="text-gray-800 font-medium">{action.assigned_to_name ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Frist</span>
                      <p className={`font-medium ${caOverdue ? "text-red-600" : "text-gray-800"}`}>
                        {fmtDate(action.due_date)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Abgeschlossen</span>
                      <p className="text-gray-800 font-medium">{fmtDate(action.completed_at)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Verifiziert</span>
                      <p className="text-gray-800 font-medium">
                        {action.verified_at ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle size={10} className="text-green-600" />
                            {fmtDate(action.verified_at)}
                          </span>
                        ) : action.verification_required ? (
                          "Ausstehend"
                        ) : (
                          "Nicht erforderlich"
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Verification details */}
                  {action.verified_at && (
                    <div className="rounded-md bg-green-50 border border-green-200 p-3 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={12} className="text-green-600" />
                        <span className="font-medium text-green-800">
                          Verifiziert von {action.verified_by_name ?? "—"} am {fmtDate(action.verified_at)}
                        </span>
                      </div>
                      {action.verification_result && (
                        <p className="text-green-700">Ergebnis: {action.verification_result}</p>
                      )}
                      {action.verification_notes && (
                        <p className="text-green-700">{action.verification_notes}</p>
                      )}
                    </div>
                  )}

                  {/* Effectiveness review */}
                  {action.effectiveness_rating && (
                    <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs space-y-1">
                      <span className="font-medium text-blue-800">
                        Wirksamkeitsprüfung: {action.effectiveness_rating}
                      </span>
                      {action.effectiveness_review_date && (
                        <p className="text-blue-700">Datum: {fmtDate(action.effectiveness_review_date)}</p>
                      )}
                      {action.effectiveness_notes && (
                        <p className="text-blue-700">{action.effectiveness_notes}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Field Row ── */

function FieldRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className={`text-sm mt-0.5 ${highlight ? "text-red-600 font-semibold" : "text-gray-900"}`}>
        {value}
      </dd>
    </div>
  );
}
