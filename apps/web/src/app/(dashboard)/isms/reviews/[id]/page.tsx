"use client";

// Management-Review-Cockpit (ISO 27001 Kap. 9.3)
//
// Tabs:
//   cockpit  — aggregierte 9.3.2-Inputs (a–h) mit „Als Review-Punkt
//              übernehmen" je Kategorie
//   protocol — strukturierte Review-Punkte (Kategorie, Feststellung,
//              Beschluss, optionale Maßnahme → work_item)
//   inputs/decisions/actions/minutes — Bestand (Freitext-Felder, legacy jsonb)
//
// Statusfluss: planned → in_progress → completed. Bei completed ist das
// Review read-only (Server erzwingt 422 auf Item-Mutationen).

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Save,
  FileDown,
  Play,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  ManagementReview,
  ManagementReviewItem,
  ReviewStatus,
} from "@grc/shared";

// ─── Dashboard payload types (GET /dashboard) ────────────────────

interface PrevActionRow {
  id: string;
  category: string;
  content: string;
  decision: string | null;
  actionWorkItemId: string | null;
  actionElementId: string | null;
  actionName: string | null;
  actionStatus: string | null;
  actionDueDate: string | null;
}

interface DashboardData {
  period: {
    from: string;
    to: string;
    source: "override" | "review_period" | "last_completed" | "fallback_12m";
  };
  previousActions: {
    review: { id: string; title: string; reviewDate: string } | null;
    items: PrevActionRow[];
    legacyActionItems: unknown;
  };
  risks: {
    byStatus: Record<string, number>;
    newInPeriod: number;
    closedInPeriod: number;
    top: Array<{
      id: string;
      title: string;
      status: string;
      riskScoreResidual: number | null;
    }>;
    acceptances: {
      activeCount: number;
      expiringSoonest: Array<{
        id: string;
        riskId: string;
        riskTitle: string | null;
        validUntil: string | null;
        riskLevelAtAcceptance: string;
      }>;
    };
  };
  findings: {
    byStatus: Record<string, number>;
    open: number;
    closedInPeriod: number;
    overdue: Array<{
      id: string;
      title: string;
      severity: string;
      status: string;
      remediationDueDate: string | null;
    }>;
    overdueCount: number;
  };
  audits: {
    completedInPeriod: Array<{
      id: string;
      title: string;
      auditType: string;
      conclusion: string | null;
      actualEnd: string | null;
      findingCount: number | null;
    }>;
    completedCount: number;
  };
  controlEffectiveness: {
    byToeResult: Record<string, number>;
    testedInPeriod: number;
  };
  incidents: {
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    totalInPeriod: number;
    recent: Array<{
      id: string;
      elementId: string;
      title: string;
      severity: string;
      status: string;
      detectedAt: string;
    }>;
  };
  documents: {
    overdueReviewCount: number;
    overdue: Array<{
      id: string;
      title: string;
      category: string;
      status: string;
      reviewDate: string | null;
    }>;
  };
  kpis: {
    byAlertStatus: Record<string, number>;
    red: Array<{
      id: string;
      name: string;
      currentValue: string | null;
      unit: string | null;
      trend: string;
      lastMeasuredAt: string | null;
    }>;
  };
}

interface OrgUser {
  id: string;
  name: string | null;
  email: string;
}

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

const STATUS_COLORS: Record<ReviewStatus, string> = {
  planned: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-900",
  completed: "bg-green-100 text-green-900",
  cancelled: "bg-red-100 text-red-900",
};

const ITEM_CATEGORIES = [
  "previous_actions",
  "context_changes",
  "risks",
  "findings",
  "audits",
  "control_effectiveness",
  "incidents",
  "documents",
  "kpis",
  "improvement",
  "other",
] as const;

type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export default function ReviewDetailPage() {
  return (
    <ModuleGate moduleKey="isms">
      <ReviewDetailInner />
    </ModuleGate>
  );
}

function ReviewDetailInner() {
  const t = useTranslations("ismsAssessment");
  const tmr = useTranslations("managementReview");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [review, setReview] = useState<ManagementReview | null>(null);
  const [items, setItems] = useState<ManagementReviewItem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState(false);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adoptedKeys, setAdoptedKeys] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<
    "cockpit" | "protocol" | "inputs" | "decisions" | "actions" | "minutes"
  >("cockpit");

  // Legacy free-text form state (Bestand)
  const [changesInContext, setChangesInContext] = useState("");
  const [performanceFeedback, setPerformanceFeedback] = useState("");
  const [auditResults, setAuditResults] = useState("");
  const [improvementOpportunities, setImprovementOpportunities] = useState("");
  const [minutes, setMinutes] = useState("");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  const isReadOnly =
    review?.status === "completed" || review?.status === "cancelled";

  const fetchReview = useCallback(async () => {
    const res = await fetch(`/api/v1/isms/reviews/${id}`);
    if (!res.ok) return;
    const json = await res.json();
    const r = json.data as ManagementReview;
    setReview(r);
    setChangesInContext(r.changesInContext ?? "");
    setPerformanceFeedback(r.performanceFeedback ?? "");
    setAuditResults(r.auditResults ?? "");
    setImprovementOpportunities(r.improvementOpportunities ?? "");
    setMinutes(r.minutes ?? "");
    setDecisions(Array.isArray(r.decisions) ? (r.decisions as Decision[]) : []);
    setActionItems(
      Array.isArray(r.actionItems) ? (r.actionItems as ActionItem[]) : [],
    );
  }, [id]);

  const fetchItems = useCallback(async () => {
    const res = await fetch(`/api/v1/isms/reviews/${id}/items`);
    if (!res.ok) return;
    const json = await res.json();
    setItems((json.data ?? []) as ManagementReviewItem[]);
  }, [id]);

  const fetchDashboard = useCallback(async () => {
    setDashboardError(false);
    const res = await fetch(`/api/v1/isms/reviews/${id}/dashboard`);
    if (!res.ok) {
      setDashboardError(true);
      return;
    }
    const json = await res.json();
    setDashboard(json.data as DashboardData);
  }, [id]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await Promise.all([fetchReview(), fetchItems(), fetchDashboard()]);
        const usersRes = await fetch("/api/v1/users?limit=100");
        if (usersRes.ok) {
          const json = await usersRes.json();
          setUsers((json.data ?? []) as OrgUser[]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchReview, fetchItems, fetchDashboard]);

  const handleSaveLegacy = async () => {
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

  const handleTransition = async (status: ReviewStatus) => {
    if (status === "completed" && !window.confirm(tmr("statusFlow.completeConfirm"))) {
      return;
    }
    await fetch(`/api/v1/isms/reviews/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    void fetchReview();
  };

  const adoptItem = async (key: string, category: ItemCategory, content: string) => {
    const res = await fetch(`/api/v1/isms/reviews/${id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, content }),
    });
    if (res.ok) {
      setAdoptedKeys((prev) => new Set(prev).add(key));
      void fetchItems();
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/isms/reviews")}
            className="text-gray-400 hover:text-gray-600"
            aria-label={t("actions.cancel")}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{review.title}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <Badge variant="outline" className={STATUS_COLORS[review.status]}>
                {t(`review.statuses.${review.status}`)}
              </Badge>
              <span className="text-sm text-gray-500">
                {t("review.date")}: {review.reviewDate}
              </span>
              {review.completedAt && (
                <span className="text-sm text-gray-500">
                  {tmr("statusFlow.completedAt")}:{" "}
                  {new Date(review.completedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href={`/api/v1/isms/reviews/${id}/export/pdf`}>
            <Button variant="outline" size="sm">
              <FileDown size={14} className="mr-1" /> {tmr("exportPdf")}
            </Button>
          </a>
          {!isReadOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveLegacy}
              disabled={saving}
            >
              <Save size={14} className="mr-1" /> {t("actions.save")}
            </Button>
          )}
          {review.status === "planned" && (
            <Button size="sm" onClick={() => handleTransition("in_progress")}>
              <Play size={14} className="mr-1" /> {tmr("statusFlow.start")}
            </Button>
          )}
          {review.status === "in_progress" && (
            <Button size="sm" onClick={() => handleTransition("completed")}>
              <CheckCircle2 size={14} className="mr-1" />{" "}
              {tmr("statusFlow.complete")}
            </Button>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock size={14} /> {tmr("protocol.readOnly")}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        <TabButton
          active={activeTab === "cockpit"}
          onClick={() => setActiveTab("cockpit")}
          label={tmr("cockpit.tab")}
        />
        <TabButton
          active={activeTab === "protocol"}
          onClick={() => setActiveTab("protocol")}
          label={tmr("protocol.tab")}
        />
        {(["inputs", "decisions", "actions", "minutes"] as const).map((tab) => (
          <TabButton
            key={tab}
            active={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            label={t(`review.tabs.${tab}`)}
          />
        ))}
      </div>

      {activeTab === "cockpit" && (
        <CockpitTab
          tmr={tmr}
          dashboard={dashboard}
          dashboardError={dashboardError}
          isReadOnly={isReadOnly}
          adoptedKeys={adoptedKeys}
          onAdopt={adoptItem}
        />
      )}

      {activeTab === "protocol" && (
        <ProtocolTab
          tmr={tmr}
          items={items}
          users={users}
          isReadOnly={isReadOnly}
          reviewId={id}
          onChanged={() => void fetchItems()}
        />
      )}

      {/* ── Bestand: Freitext-Tabs ───────────────────────────── */}

      {activeTab === "inputs" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-6">
          {(
            [
              [
                "changesInContext",
                changesInContext,
                setChangesInContext,
                t("review.changesInContext"),
              ],
              [
                "performance",
                performanceFeedback,
                setPerformanceFeedback,
                t("review.performance"),
              ],
              ["auditResults", auditResults, setAuditResults, t("review.auditResults")],
              [
                "improvements",
                improvementOpportunities,
                setImprovementOpportunities,
                t("review.improvements"),
              ],
            ] as Array<[string, string, (v: string) => void, string]>
          ).map(([key, value, setter, label]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {label}
              </label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                rows={4}
                value={value}
                disabled={isReadOnly}
                onChange={(e) => setter(e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

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
                disabled={isReadOnly}
                onChange={(e) => {
                  const next = [...decisions];
                  next[i] = { ...d, text: e.target.value };
                  setDecisions(next);
                }}
              />
              {!isReadOnly && (
                <button
                  onClick={() => setDecisions(decisions.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600 text-sm"
                >
                  x
                </button>
              )}
            </div>
          ))}
          {!isReadOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDecisions([...decisions, { text: "" }])}
            >
              {t("review.addDecision")}
            </Button>
          )}
        </div>
      )}

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
                        disabled={isReadOnly}
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
                        disabled={isReadOnly}
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
                        disabled={isReadOnly}
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
                        disabled={isReadOnly}
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
                      {!isReadOnly && (
                        <button
                          onClick={() =>
                            setActionItems(actionItems.filter((_, j) => j !== i))
                          }
                          className="text-red-400 hover:text-red-600 text-sm"
                        >
                          x
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isReadOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setActionItems([
                  ...actionItems,
                  { title: "", responsible: "", dueDate: "", status: "open" },
                ])
              }
            >
              {t("review.addAction")}
            </Button>
          )}
        </div>
      )}

      {activeTab === "minutes" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("review.minutesLabel")}
          </label>
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            rows={15}
            value={minutes}
            disabled={isReadOnly}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder={t("review.minutesPlaceholder")}
          />
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? "border-blue-500 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Cockpit-Tab ──────────────────────────────────────────────────

type Translator = ReturnType<typeof useTranslations>;

function CockpitCard({
  title,
  kpis,
  children,
  adoptKey,
  adoptContent,
  category,
  tmr,
  isReadOnly,
  adoptedKeys,
  onAdopt,
}: {
  title: string;
  kpis: Array<{ label: string; value: number | string }>;
  children?: ReactNode;
  adoptKey: string;
  adoptContent: string;
  category: ItemCategory;
  tmr: Translator;
  isReadOnly: boolean;
  adoptedKeys: Set<string>;
  onAdopt: (key: string, category: ItemCategory, content: string) => void;
}) {
  const adopted = adoptedKeys.has(adoptKey);
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {!isReadOnly && (
          <Button
            variant="outline"
            size="sm"
            disabled={adopted}
            onClick={() => onAdopt(adoptKey, category, adoptContent)}
          >
            {adopted ? tmr("cockpit.adopted") : tmr("cockpit.adopt")}
          </Button>
        )}
      </div>
      <div className="flex gap-4 flex-wrap">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-[90px]">
            <div className="text-xl font-bold text-gray-900">{k.value}</div>
            <div className="text-xs text-gray-500">{k.label}</div>
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

function CompactList({ rows }: { rows: Array<{ key: string; left: string; right?: string }> }) {
  if (rows.length === 0) return null;
  return (
    <ul className="divide-y divide-gray-100 text-sm">
      {rows.map((r) => (
        <li key={r.key} className="flex justify-between gap-3 py-1.5">
          <span className="text-gray-700 truncate">{r.left}</span>
          {r.right && (
            <span className="text-gray-400 shrink-0 text-xs">{r.right}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function statusSummary(byStatus: Record<string, number>): string {
  return Object.entries(byStatus)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

function CockpitTab({
  tmr,
  dashboard,
  dashboardError,
  isReadOnly,
  adoptedKeys,
  onAdopt,
}: {
  tmr: Translator;
  dashboard: DashboardData | null;
  dashboardError: boolean;
  isReadOnly: boolean;
  adoptedKeys: Set<string>;
  onAdopt: (key: string, category: ItemCategory, content: string) => void;
}) {
  if (dashboardError) {
    return (
      <p className="text-center text-sm text-gray-400 py-8">
        {tmr("cockpit.loadError")}
      </p>
    );
  }
  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-40 gap-2 text-gray-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> {tmr("cockpit.loading")}
      </div>
    );
  }

  const d = dashboard;
  const prev = d.previousActions;
  const openRisks = Object.entries(d.risks.byStatus)
    .filter(([k]) => k !== "closed")
    .reduce((acc, [, v]) => acc + v, 0);
  const prevOpen = prev.items.filter(
    (i) => i.actionStatus !== "completed" && i.actionStatus !== "obsolete",
  ).length;
  const prevDone = prev.items.length - prevOpen;
  const cardProps = { tmr, isReadOnly, adoptedKeys, onAdopt };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        {tmr("cockpit.period")}: {d.period.from} — {d.period.to} (
        {tmr(`cockpit.periodSource.${d.period.source}`)})
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* (a) Maßnahmen aus dem letzten Review */}
        <CockpitCard
          {...cardProps}
          title={tmr("cockpit.sections.previousActions.title")}
          category="previous_actions"
          adoptKey="previousActions"
          adoptContent={
            prev.review
              ? `${tmr("cockpit.sections.previousActions.title")} (${prev.review.title}, ${prev.review.reviewDate}): ` +
                `${tmr("cockpit.sections.previousActions.openCount")}: ${prevOpen}, ` +
                `${tmr("cockpit.sections.previousActions.doneCount")}: ${prevDone}. ` +
                prev.items
                  .map(
                    (i) =>
                      `${i.actionElementId ?? ""} ${i.actionName ?? ""} [${i.actionStatus ?? "?"}]`,
                  )
                  .join("; ")
              : tmr("cockpit.sections.previousActions.none")
          }
          kpis={[
            {
              label: tmr("cockpit.sections.previousActions.openCount"),
              value: prevOpen,
            },
            {
              label: tmr("cockpit.sections.previousActions.doneCount"),
              value: prevDone,
            },
          ]}
        >
          {!prev.review ? (
            <p className="text-sm text-gray-400">
              {tmr("cockpit.sections.previousActions.none")}
            </p>
          ) : prev.items.length === 0 ? (
            <p className="text-sm text-gray-400">
              {tmr("cockpit.sections.previousActions.empty")}
            </p>
          ) : (
            <CompactList
              rows={prev.items.map((i) => ({
                key: i.id,
                left: `${i.actionElementId ?? ""} ${i.actionName ?? i.content}`,
                right: i.actionStatus ?? undefined,
              }))}
            />
          )}
          {prev.review && (
            <p className="text-xs text-gray-400">
              {tmr("cockpit.sections.previousActions.sourceReview")}:{" "}
              {prev.review.title} ({prev.review.reviewDate})
            </p>
          )}
        </CockpitCard>

        {/* (b) Risiko-Lage */}
        <CockpitCard
          {...cardProps}
          title={tmr("cockpit.sections.risks.title")}
          category="risks"
          adoptKey="risks"
          adoptContent={
            `${tmr("cockpit.sections.risks.title")}: ` +
            `${tmr("cockpit.sections.risks.open")}: ${openRisks} (${statusSummary(d.risks.byStatus)}); ` +
            `${tmr("cockpit.sections.risks.newInPeriod")}: ${d.risks.newInPeriod}; ` +
            `${tmr("cockpit.sections.risks.closedInPeriod")}: ${d.risks.closedInPeriod}; ` +
            `${tmr("cockpit.sections.risks.acceptances")}: ${d.risks.acceptances.activeCount}`
          }
          kpis={[
            { label: tmr("cockpit.sections.risks.open"), value: openRisks },
            {
              label: tmr("cockpit.sections.risks.newInPeriod"),
              value: d.risks.newInPeriod,
            },
            {
              label: tmr("cockpit.sections.risks.closedInPeriod"),
              value: d.risks.closedInPeriod,
            },
            {
              label: tmr("cockpit.sections.risks.acceptances"),
              value: d.risks.acceptances.activeCount,
            },
          ]}
        >
          <p className="text-xs font-medium text-gray-500">
            {tmr("cockpit.sections.risks.topRisks")}
          </p>
          <CompactList
            rows={d.risks.top.map((r) => ({
              key: r.id,
              left: r.title,
              right: `${r.riskScoreResidual ?? "—"}`,
            }))}
          />
          {d.risks.acceptances.expiringSoonest.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-500">
                {tmr("cockpit.sections.risks.acceptancesExpiring")}
              </p>
              <CompactList
                rows={d.risks.acceptances.expiringSoonest.map((a) => ({
                  key: a.id,
                  left: a.riskTitle ?? a.riskId,
                  right: a.validUntil
                    ? `${tmr("cockpit.sections.risks.validUntil")} ${a.validUntil}`
                    : undefined,
                }))}
              />
            </>
          )}
        </CockpitCard>

        {/* (c) Findings */}
        <CockpitCard
          {...cardProps}
          title={tmr("cockpit.sections.findings.title")}
          category="findings"
          adoptKey="findings"
          adoptContent={
            `${tmr("cockpit.sections.findings.title")}: ` +
            `${tmr("cockpit.sections.findings.open")}: ${d.findings.open}; ` +
            `${tmr("cockpit.sections.findings.closedInPeriod")}: ${d.findings.closedInPeriod}; ` +
            `${tmr("cockpit.sections.findings.overdue")}: ${d.findings.overdueCount}` +
            (d.findings.overdue.length > 0
              ? ` (${d.findings.overdue.map((f) => f.title).join("; ")})`
              : "")
          }
          kpis={[
            {
              label: tmr("cockpit.sections.findings.open"),
              value: d.findings.open,
            },
            {
              label: tmr("cockpit.sections.findings.closedInPeriod"),
              value: d.findings.closedInPeriod,
            },
            {
              label: tmr("cockpit.sections.findings.overdue"),
              value: d.findings.overdueCount,
            },
          ]}
        >
          <CompactList
            rows={d.findings.overdue.map((f) => ({
              key: f.id,
              left: f.title,
              right: f.remediationDueDate
                ? `${tmr("cockpit.sections.findings.dueSince")} ${f.remediationDueDate}`
                : undefined,
            }))}
          />
        </CockpitCard>

        {/* (d) Audits */}
        <CockpitCard
          {...cardProps}
          title={tmr("cockpit.sections.audits.title")}
          category="audits"
          adoptKey="audits"
          adoptContent={
            `${tmr("cockpit.sections.audits.title")}: ` +
            `${tmr("cockpit.sections.audits.completedInPeriod")}: ${d.audits.completedCount}. ` +
            d.audits.completedInPeriod
              .map(
                (a) =>
                  `${a.title} (${tmr("cockpit.sections.audits.conclusion")}: ${a.conclusion ?? "—"}, ${tmr("cockpit.sections.audits.findings")}: ${a.findingCount ?? 0})`,
              )
              .join("; ")
          }
          kpis={[
            {
              label: tmr("cockpit.sections.audits.completedInPeriod"),
              value: d.audits.completedCount,
            },
          ]}
        >
          <CompactList
            rows={d.audits.completedInPeriod.map((a) => ({
              key: a.id,
              left: a.title,
              right: `${a.conclusion ?? "—"} · ${a.actualEnd ?? ""}`,
            }))}
          />
        </CockpitCard>

        {/* (e) Kontroll-Wirksamkeit */}
        <CockpitCard
          {...cardProps}
          title={tmr("cockpit.sections.controlEffectiveness.title")}
          category="control_effectiveness"
          adoptKey="controlEffectiveness"
          adoptContent={
            `${tmr("cockpit.sections.controlEffectiveness.title")}: ` +
            `${tmr("cockpit.sections.controlEffectiveness.testedInPeriod")}: ${d.controlEffectiveness.testedInPeriod} ` +
            `(${statusSummary(d.controlEffectiveness.byToeResult)})`
          }
          kpis={[
            {
              label: tmr("cockpit.sections.controlEffectiveness.testedInPeriod"),
              value: d.controlEffectiveness.testedInPeriod,
            },
            {
              label: tmr("cockpit.sections.controlEffectiveness.effective"),
              value: d.controlEffectiveness.byToeResult["effective"] ?? 0,
            },
            {
              label: tmr("cockpit.sections.controlEffectiveness.ineffective"),
              value: d.controlEffectiveness.byToeResult["ineffective"] ?? 0,
            },
          ]}
        >
          {d.controlEffectiveness.testedInPeriod === 0 && (
            <p className="text-sm text-gray-400">{tmr("cockpit.noData")}</p>
          )}
        </CockpitCard>

        {/* (f) Incidents */}
        <CockpitCard
          {...cardProps}
          title={tmr("cockpit.sections.incidents.title")}
          category="incidents"
          adoptKey="incidents"
          adoptContent={
            `${tmr("cockpit.sections.incidents.title")}: ` +
            `${tmr("cockpit.sections.incidents.totalInPeriod")}: ${d.incidents.totalInPeriod} ` +
            `(${tmr("cockpit.sections.incidents.bySeverity")}: ${statusSummary(d.incidents.bySeverity)})`
          }
          kpis={[
            {
              label: tmr("cockpit.sections.incidents.totalInPeriod"),
              value: d.incidents.totalInPeriod,
            },
            ...Object.entries(d.incidents.bySeverity).map(([sev, n]) => ({
              label: sev,
              value: n,
            })),
          ]}
        >
          <CompactList
            rows={d.incidents.recent.map((i) => ({
              key: i.id,
              left: `${i.elementId} ${i.title}`,
              right: `${i.severity} · ${i.status}`,
            }))}
          />
        </CockpitCard>

        {/* (g) Dokumente */}
        <CockpitCard
          {...cardProps}
          title={tmr("cockpit.sections.documents.title")}
          category="documents"
          adoptKey="documents"
          adoptContent={
            `${tmr("cockpit.sections.documents.title")}: ` +
            `${tmr("cockpit.sections.documents.overdueReviews")}: ${d.documents.overdueReviewCount}` +
            (d.documents.overdue.length > 0
              ? ` (${d.documents.overdue.map((doc) => doc.title).join("; ")})`
              : "")
          }
          kpis={[
            {
              label: tmr("cockpit.sections.documents.overdueReviews"),
              value: d.documents.overdueReviewCount,
            },
          ]}
        >
          <CompactList
            rows={d.documents.overdue.map((doc) => ({
              key: doc.id,
              left: doc.title,
              right: doc.reviewDate
                ? `${tmr("cockpit.sections.documents.reviewDue")} ${doc.reviewDate.slice(0, 10)}`
                : undefined,
            }))}
          />
        </CockpitCard>

        {/* (h) KPIs / KRIs */}
        <CockpitCard
          {...cardProps}
          title={tmr("cockpit.sections.kpis.title")}
          category="kpis"
          adoptKey="kpis"
          adoptContent={
            `${tmr("cockpit.sections.kpis.title")}: ` +
            `${tmr("cockpit.sections.kpis.byAlert")}: ${statusSummary(d.kpis.byAlertStatus)}` +
            (d.kpis.red.length > 0
              ? `. ${tmr("cockpit.sections.kpis.red")}: ${d.kpis.red.map((k) => k.name).join("; ")}`
              : "")
          }
          kpis={[
            {
              label: tmr("cockpit.sections.kpis.green"),
              value: d.kpis.byAlertStatus["green"] ?? 0,
            },
            {
              label: tmr("cockpit.sections.kpis.yellow"),
              value: d.kpis.byAlertStatus["yellow"] ?? 0,
            },
            {
              label: tmr("cockpit.sections.kpis.redLabel"),
              value: d.kpis.byAlertStatus["red"] ?? 0,
            },
          ]}
        >
          <CompactList
            rows={d.kpis.red.map((k) => ({
              key: k.id,
              left: k.name,
              right: k.currentValue
                ? `${k.currentValue}${k.unit ? ` ${k.unit}` : ""}`
                : undefined,
            }))}
          />
        </CockpitCard>
      </div>
    </div>
  );
}

// ─── Protokoll-Tab ────────────────────────────────────────────────

function ProtocolTab({
  tmr,
  items,
  users,
  isReadOnly,
  reviewId,
  onChanged,
}: {
  tmr: Translator;
  items: ManagementReviewItem[];
  users: OrgUser[];
  isReadOnly: boolean;
  reviewId: string;
  onChanged: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState<ItemCategory>("other");
  const [newContent, setNewContent] = useState("");

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    const res = await fetch(`/api/v1/isms/reviews/${reviewId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: newCategory, content: newContent }),
    });
    if (res.ok) {
      setNewContent("");
      setShowAdd(false);
      onChanged();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          {tmr("protocol.title")}
        </h2>
        {!isReadOnly && (
          <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={14} className="mr-1" /> {tmr("protocol.addItem")}
          </Button>
        )}
      </div>

      {showAdd && !isReadOnly && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ItemCategory)}
            >
              {ITEM_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {tmr(`protocol.categories.${c}`)}
                </option>
              ))}
            </select>
            <textarea
              className="flex-1 min-w-[240px] rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={2}
              value={newContent}
              placeholder={tmr("protocol.contentPlaceholder")}
              onChange={(e) => setNewContent(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>
              {tmr("protocol.cancel")}
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={!newContent.trim()}>
              {tmr("protocol.save")}
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">
          {tmr("protocol.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <ProtocolItemRow
              key={item.id}
              tmr={tmr}
              index={idx}
              item={item}
              users={users}
              isReadOnly={isReadOnly}
              reviewId={reviewId}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProtocolItemRow({
  tmr,
  index,
  item,
  users,
  isReadOnly,
  reviewId,
  onChanged,
}: {
  tmr: Translator;
  index: number;
  item: ManagementReviewItem;
  users: OrgUser[];
  isReadOnly: boolean;
  reviewId: string;
  onChanged: () => void;
}) {
  const [category, setCategory] = useState(item.category);
  const [content, setContent] = useState(item.content);
  const [decision, setDecision] = useState(item.decision ?? "");
  const [showAction, setShowAction] = useState(false);
  const [actionTitle, setActionTitle] = useState("");
  const [actionResponsible, setActionResponsible] = useState("");
  const [actionDueDate, setActionDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty =
    category !== item.category ||
    content !== item.content ||
    decision !== (item.decision ?? "");

  const save = async (withAction: boolean) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        category,
        content,
        decision: decision || null,
      };
      if (withAction && actionTitle.trim()) {
        body.action = {
          title: actionTitle,
          ...(actionResponsible ? { responsibleId: actionResponsible } : {}),
          ...(actionDueDate ? { dueDate: actionDueDate } : {}),
        };
      }
      const res = await fetch(
        `/api/v1/isms/reviews/${reviewId}/items/${item.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) {
        setShowAction(false);
        setActionTitle("");
        onChanged();
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const res = await fetch(
      `/api/v1/isms/reviews/${reviewId}/items/${item.id}`,
      { method: "DELETE" },
    );
    if (res.ok) onChanged();
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-gray-400">{index + 1}.</span>
          {isReadOnly ? (
            <Badge variant="outline" className="bg-gray-50 text-gray-600">
              {tmr(`protocol.categories.${category}`)}
            </Badge>
          ) : (
            <select
              className="rounded-md border border-gray-300 px-2 py-1 text-xs"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {ITEM_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {tmr(`protocol.categories.${c}`)}
                </option>
              ))}
            </select>
          )}
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            {dirty && (
              <Button size="sm" onClick={() => save(false)} disabled={saving}>
                {tmr("protocol.save")}
              </Button>
            )}
            <button
              onClick={remove}
              className="text-red-400 hover:text-red-600"
              aria-label={tmr("protocol.delete")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {tmr("protocol.content")}
          </label>
          {isReadOnly ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{content}</p>
          ) : (
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {tmr("protocol.decision")}
          </label>
          {isReadOnly ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {decision || "—"}
            </p>
          ) : (
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              value={decision}
              placeholder={tmr("protocol.decisionPlaceholder")}
              onChange={(e) => setDecision(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Maßnahme */}
      <div className="text-sm">
        {item.actionWorkItemId ? (
          <div className="flex items-center gap-2 text-gray-700">
            <CheckCircle2 size={14} className="text-blue-500" />
            <span className="font-mono text-xs text-gray-400">
              {item.actionElementId}
            </span>
            <span>{item.actionName}</span>
            {item.actionStatus && (
              <Badge variant="outline" className="bg-blue-50 text-blue-800">
                {item.actionStatus}
              </Badge>
            )}
          </div>
        ) : isReadOnly ? (
          <p className="text-xs text-gray-400">{tmr("protocol.noAction")}</p>
        ) : showAction ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={actionTitle}
                placeholder={tmr("protocol.actionTitle")}
                onChange={(e) => setActionTitle(e.target.value)}
              />
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={actionResponsible}
                onChange={(e) => setActionResponsible(e.target.value)}
              >
                <option value="">{tmr("protocol.noResponsible")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={actionDueDate}
                onChange={(e) => setActionDueDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAction(false)}
              >
                {tmr("protocol.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={() => save(true)}
                disabled={saving || !actionTitle.trim()}
              >
                {tmr("protocol.save")}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAction(true)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            + {tmr("protocol.createAction")}
          </button>
        )}
      </div>
    </div>
  );
}
