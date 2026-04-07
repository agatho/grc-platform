"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldAlert,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  ExternalLink,
  FileText,
  Inbox,
  Activity,
  Link2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { ModuleGate } from "@/components/module/module-gate";
import { EntityDocumentsPanel } from "@/components/documents/entity-documents-panel";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

import type {
  Risk,
  RiskTreatment,
  KRI,
  KRIMeasurement,
  RiskCategory,
  RiskStatus,
  TreatmentStrategy,
  TreatmentStatus,
  KriAlertStatus,
  KriTrend,
} from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiskDetail extends Risk {
  elementId?: string;
  workItemStatus?: string;
  ownerName?: string;
  ownerEmail?: string;
  treatments: RiskTreatmentWithResponsible[];
}

interface RiskTreatmentWithResponsible extends RiskTreatment {
  responsibleName?: string;
  responsibleEmail?: string;
}

interface KriWithMeasurements extends KRI {
  linkedRiskName?: string;
  measurements?: KRIMeasurement[];
}

interface AuditLogEntry {
  id: string;
  userName: string | null;
  userEmail: string | null;
  action: "create" | "update" | "delete";
  entityType: string;
  entityTitle: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  createdAt: string;
}

interface LinkageItem {
  id: string;
  requirementId?: string;
  processId?: string;
  assetId?: string;
  riskContext?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusColors: Record<RiskStatus, string> = {
  identified: "bg-blue-100 text-blue-900",
  assessed: "bg-indigo-100 text-indigo-900",
  treated: "bg-green-100 text-green-900",
  accepted: "bg-amber-100 text-amber-900",
  closed: "bg-gray-100 text-gray-600",
};

const categoryColors: Record<RiskCategory, string> = {
  strategic: "bg-purple-100 text-purple-900",
  operational: "bg-orange-100 text-orange-900",
  financial: "bg-emerald-100 text-emerald-900",
  compliance: "bg-blue-100 text-blue-900",
  cyber: "bg-red-100 text-red-900",
  reputational: "bg-pink-100 text-pink-900",
  esg: "bg-teal-100 text-teal-900",
};

const treatmentStatusColors: Record<TreatmentStatus, string> = {
  planned: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-900",
  completed: "bg-green-100 text-green-900",
  cancelled: "bg-red-100 text-red-600",
};

const alertColors: Record<KriAlertStatus, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
};

function scoreBadge(score: number | null | undefined): {
  label: string;
  color: string;
} {
  if (score == null) return { label: "-", color: "bg-gray-100 text-gray-500" };
  if (score >= 20) return { label: String(score), color: "bg-red-100 text-red-900" };
  if (score >= 15) return { label: String(score), color: "bg-orange-100 text-orange-900" };
  if (score >= 10) return { label: String(score), color: "bg-yellow-100 text-yellow-900" };
  if (score >= 5) return { label: String(score), color: "bg-blue-100 text-blue-900" };
  return { label: String(score), color: "bg-green-100 text-green-900" };
}

function formatCurrency(value: string | null | undefined): string {
  if (!value) return "-";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(num);
}

function trendIcon(trend: KriTrend) {
  switch (trend) {
    case "improving":
      return <TrendingDown size={14} className="text-green-600" />;
    case "worsening":
      return <TrendingUp size={14} className="text-red-600" />;
    default:
      return <Minus size={14} className="text-gray-400" />;
  }
}

// ---------------------------------------------------------------------------
// Mini Heat Map (320px)
// ---------------------------------------------------------------------------

function MiniHeatMap({
  inherentL,
  inherentI,
  residualL,
  residualI,
}: {
  inherentL: number | null | undefined;
  inherentI: number | null | undefined;
  residualL: number | null | undefined;
  residualI: number | null | undefined;
}) {
  const cellSize = 56;
  const gap = 4;
  const labelW = 20;
  const totalW = labelW + 5 * (cellSize + gap);
  const totalH = labelW + 5 * (cellSize + gap);

  function cellColor(l: number, i: number): string {
    const score = l * i;
    if (score >= 20) return "bg-red-500";
    if (score >= 15) return "bg-orange-400";
    if (score >= 10) return "bg-yellow-300";
    if (score >= 5) return "bg-blue-200";
    return "bg-green-200";
  }

  return (
    <div className="flex flex-col items-center">
      <div
        style={{ width: totalW, height: totalH }}
        className="relative"
      >
        {/* Y-axis labels */}
        {[5, 4, 3, 2, 1].map((l, rowIdx) => (
          <span
            key={`yl-${l}`}
            className="absolute text-[10px] text-gray-400 font-medium"
            style={{
              left: 0,
              top: labelW + rowIdx * (cellSize + gap) + cellSize / 2 - 6,
            }}
          >
            {l}
          </span>
        ))}

        {/* X-axis labels */}
        {[1, 2, 3, 4, 5].map((i, colIdx) => (
          <span
            key={`xl-${i}`}
            className="absolute text-[10px] text-gray-400 font-medium"
            style={{
              left: labelW + colIdx * (cellSize + gap) + cellSize / 2 - 4,
              top: totalH - 14,
            }}
          >
            {i}
          </span>
        ))}

        {/* Grid cells */}
        {[5, 4, 3, 2, 1].map((l, rowIdx) =>
          [1, 2, 3, 4, 5].map((i, colIdx) => (
            <div
              key={`${l}-${i}`}
              className={`absolute rounded ${cellColor(l, i)} opacity-30`}
              style={{
                left: labelW + colIdx * (cellSize + gap),
                top: rowIdx * (cellSize + gap),
                width: cellSize,
                height: cellSize,
              }}
            />
          )),
        )}

        {/* Inherent dot (solid) */}
        {inherentL != null && inherentI != null && (
          <div
            className="absolute w-5 h-5 rounded-full bg-slate-800 border-2 border-white shadow-md z-10"
            style={{
              left:
                labelW +
                (inherentI - 1) * (cellSize + gap) +
                cellSize / 2 -
                10,
              top:
                (5 - inherentL) * (cellSize + gap) +
                cellSize / 2 -
                10,
            }}
            title={`Inherent: L${inherentL} x I${inherentI}`}
          />
        )}

        {/* Residual dot (outlined) */}
        {residualL != null && residualI != null && (
          <div
            className="absolute w-5 h-5 rounded-full border-2 border-slate-800 bg-white shadow-md z-10"
            style={{
              left:
                labelW +
                (residualI - 1) * (cellSize + gap) +
                cellSize / 2 -
                10,
              top:
                (5 - residualL) * (cellSize + gap) +
                cellSize / 2 -
                10,
            }}
            title={`Residual: L${residualL} x I${residualI}`}
          />
        )}
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-slate-800" /> Inherent
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full border-2 border-slate-800 bg-white" />{" "}
          Residual
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KRI Sparkline
// ---------------------------------------------------------------------------

function KriSparkline({
  measurements,
  alertStatus,
}: {
  measurements: KRIMeasurement[];
  alertStatus: KriAlertStatus;
}) {
  const lineColor =
    alertStatus === "red"
      ? "#ef4444"
      : alertStatus === "yellow"
        ? "#eab308"
        : "#22c55e";

  const data = [...measurements]
    .sort(
      (a, b) =>
        new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
    )
    .map((m) => ({
      date: new Date(m.measuredAt).toLocaleDateString(),
      value: parseFloat(m.value),
    }));

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[60px] text-xs text-gray-400">
        Not enough data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={60}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={2}
          dot={false}
        />
        <Tooltip
          contentStyle={{ fontSize: "11px", padding: "4px 8px" }}
          labelStyle={{ fontSize: "10px" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

function RiskDetailContent() {
  const t = useTranslations("risk.detail");
  const params = useParams();
  const router = useRouter();
  const riskId = params.id as string;

  const [riskData, setRiskData] = useState<RiskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // KRIs for this risk
  const [kris, setKris] = useState<KriWithMeasurements[]>([]);
  const [krisLoading, setKrisLoading] = useState(true);

  // Audit log
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  // Linkages
  const [frameworkMappings, setFrameworkMappings] = useState<LinkageItem[]>([]);
  const [processLinks, setProcessLinks] = useState<LinkageItem[]>([]);
  const [assetLinks, setAssetLinks] = useState<LinkageItem[]>([]);
  const [linkagesLoading, setLinkagesLoading] = useState(true);

  // Assessment editing
  const [editingAssessment, setEditingAssessment] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState({
    inherentLikelihood: 1,
    inherentImpact: 1,
    residualLikelihood: 1,
    residualImpact: 1,
  });
  const [savingAssessment, setSavingAssessment] = useState(false);

  // Treatment dialog
  const [treatmentDialogOpen, setTreatmentDialogOpen] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({
    description: "",
    dueDate: "",
    costEstimate: "",
    costAnnual: "",
    effortHours: "",
    budgetId: "",
    costNote: "",
    status: "planned" as TreatmentStatus,
  });
  const [savingTreatment, setSavingTreatment] = useState(false);
  const [treatmentBudgets, setTreatmentBudgets] = useState<
    Array<{ id: string; name: string; currency: string; totalAmount: string }>
  >([]);

  // Add measurement form
  const [measKriId, setMeasKriId] = useState<string | null>(null);
  const [measForm, setMeasForm] = useState({ value: "", notes: "" });
  const [savingMeas, setSavingMeas] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch risk data
  // ---------------------------------------------------------------------------

  const fetchRisk = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/risks/${riskId}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setRiskData(json.data);
      setError(false);
      // Initialize assessment form from current data
      if (json.data) {
        setAssessmentForm({
          inherentLikelihood: json.data.inherentLikelihood ?? 1,
          inherentImpact: json.data.inherentImpact ?? 1,
          residualLikelihood: json.data.residualLikelihood ?? 1,
          residualImpact: json.data.residualImpact ?? 1,
        });
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [riskId]);

  // Fetch KRIs linked to this risk
  const fetchKris = useCallback(async () => {
    setKrisLoading(true);
    try {
      const res = await fetch(`/api/v1/kris?riskId=${riskId}&limit=50`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const kriItems: KriWithMeasurements[] = json.data ?? [];

      // Fetch last 12 measurements for each KRI
      const withMeasurements = await Promise.all(
        kriItems.map(async (k) => {
          try {
            const mRes = await fetch(
              `/api/v1/kris/${k.id}/measurements?limit=12`,
            );
            if (mRes.ok) {
              const mJson = await mRes.json();
              return { ...k, measurements: mJson.data ?? [] };
            }
          } catch {
            // Ignore measurement fetch errors
          }
          return { ...k, measurements: [] };
        }),
      );

      setKris(withMeasurements);
    } catch {
      setKris([]);
    } finally {
      setKrisLoading(false);
    }
  }, [riskId]);

  // Fetch audit log
  const fetchAuditLog = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await fetch(
        `/api/v1/audit-log?entityType=risk&entityId=${riskId}&limit=50`,
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setAuditLog(json.data ?? []);
    } catch {
      setAuditLog([]);
    } finally {
      setAuditLoading(false);
    }
  }, [riskId]);

  // Fetch linkages
  const fetchLinkages = useCallback(async () => {
    setLinkagesLoading(true);
    try {
      const [fmRes, plRes, alRes] = await Promise.all([
        fetch(`/api/v1/risks/${riskId}/framework-mappings?limit=50`),
        fetch(`/api/v1/risks/${riskId}/process-links?limit=50`),
        fetch(`/api/v1/risks/${riskId}/asset-links?limit=50`),
      ]);

      if (fmRes.ok) {
        const fmJson = await fmRes.json();
        setFrameworkMappings(fmJson.data ?? []);
      }
      if (plRes.ok) {
        const plJson = await plRes.json();
        setProcessLinks(plJson.data ?? []);
      }
      if (alRes.ok) {
        const alJson = await alRes.json();
        setAssetLinks(alJson.data ?? []);
      }
    } catch {
      // Ignore
    } finally {
      setLinkagesLoading(false);
    }
  }, [riskId]);

  useEffect(() => {
    void fetchRisk();
    void fetchKris();
    void fetchAuditLog();
    void fetchLinkages();
    fetch("/api/v1/budgets?limit=100")
      .then((r) => r.json())
      .then((json) => setTreatmentBudgets(json.data ?? []))
      .catch(() => {});
  }, [fetchRisk, fetchKris, fetchAuditLog, fetchLinkages]);

  // ---------------------------------------------------------------------------
  // Assessment save
  // ---------------------------------------------------------------------------

  async function saveAssessment() {
    setSavingAssessment(true);
    try {
      const res = await fetch(`/api/v1/risks/${riskId}/assessment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assessmentForm),
      });
      if (res.ok) {
        setEditingAssessment(false);
        await fetchRisk();
      }
    } catch {
      // Error handling
    } finally {
      setSavingAssessment(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Treatment add
  // ---------------------------------------------------------------------------

  async function addTreatment() {
    if (!treatmentForm.description.trim()) return;
    setSavingTreatment(true);
    try {
      const res = await fetch(`/api/v1/risks/${riskId}/treatments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: treatmentForm.description,
          status: treatmentForm.status,
          dueDate: treatmentForm.dueDate || undefined,
          costEstimate: treatmentForm.costEstimate
            ? parseFloat(treatmentForm.costEstimate)
            : undefined,
          costAnnual: treatmentForm.costAnnual
            ? parseFloat(treatmentForm.costAnnual)
            : undefined,
          effortHours: treatmentForm.effortHours
            ? parseFloat(treatmentForm.effortHours)
            : undefined,
          budgetId: treatmentForm.budgetId || undefined,
          costNote: treatmentForm.costNote || undefined,
        }),
      });
      if (res.ok) {
        setTreatmentDialogOpen(false);
        setTreatmentForm({
          description: "",
          dueDate: "",
          costEstimate: "",
          costAnnual: "",
          effortHours: "",
          budgetId: "",
          costNote: "",
          status: "planned",
        });
        await fetchRisk();
      }
    } catch {
      // Error handling
    } finally {
      setSavingTreatment(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Add measurement
  // ---------------------------------------------------------------------------

  async function addMeasurement() {
    if (!measKriId || !measForm.value) return;
    setSavingMeas(true);
    try {
      const res = await fetch(`/api/v1/kris/${measKriId}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: parseFloat(measForm.value),
          measuredAt: new Date().toISOString(),
          source: "manual",
          notes: measForm.notes || undefined,
        }),
      });
      if (res.ok) {
        setMeasKriId(null);
        setMeasForm({ value: "", notes: "" });
        await fetchKris();
      }
    } catch {
      // Error handling
    } finally {
      setSavingMeas(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !riskData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <ShieldAlert size={48} className="mb-4" />
        <p className="text-lg font-medium">{t("notFound")}</p>
        <Link
          href="/risks"
          className="mt-4 text-sm text-blue-600 hover:text-blue-800"
        >
          {t("backToList")}
        </Link>
      </div>
    );
  }

  const r = riskData;
  const iScore = scoreBadge(r.riskScoreInherent);
  const rScore = scoreBadge(r.riskScoreResidual);

  return (
    <div className="space-y-6">
      {/* ── Back link ──────────────────────────────────────────── */}
      <Link
        href="/risks"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        {t("backToList")}
      </Link>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {r.elementId && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {r.elementId}
                </Badge>
              )}
              <h1 className="text-2xl font-bold text-gray-900">{r.title}</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={statusColors[r.status]}>
                {t(`statuses.${r.status}`)}
              </Badge>
              <Badge className={categoryColors[r.riskCategory]}>
                {t(`categories.${r.riskCategory}`)}
              </Badge>
              {r.ownerName && (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <User size={14} />
                  {r.ownerName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Appetite indicator */}
        {r.riskAppetiteExceeded ? (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2">
            <AlertTriangle size={18} className="text-red-600" />
            <span className="text-sm font-medium text-red-700">
              {t("riskAppetiteExceeded")}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2">
            <CheckCircle2 size={18} className="text-green-600" />
            <span className="text-sm font-medium text-green-700">
              {t("riskAppetiteOk")}
            </span>
          </div>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start flex-wrap">
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="assessment">{t("tabs.assessment")}</TabsTrigger>
          <TabsTrigger value="treatment">{t("tabs.treatment")}</TabsTrigger>
          <TabsTrigger value="kris">{t("tabs.kris")}</TabsTrigger>
          <TabsTrigger value="linkages">{t("tabs.linkages")}</TabsTrigger>
          <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
          <TabsTrigger value="documents">
            <FileText size={14} className="mr-1.5" />
            {t("tabs.documents")}
          </TabsTrigger>
        </TabsList>

        {/* ══════ Overview Tab ══════ */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Description */}
          {r.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("description")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {r.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Risk scorecard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("inherentScore")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <span
                    className={`inline-flex items-center justify-center w-14 h-14 rounded-xl text-lg font-bold ${iScore.color}`}
                  >
                    {iScore.label}
                  </span>
                  <div className="text-sm text-gray-600">
                    <p>
                      {t("likelihood")}: {r.inherentLikelihood ?? "-"}
                    </p>
                    <p>
                      {t("impact")}: {r.inherentImpact ?? "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("residualScore")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <span
                    className={`inline-flex items-center justify-center w-14 h-14 rounded-xl text-lg font-bold ${rScore.color}`}
                  >
                    {rScore.label}
                  </span>
                  <div className="text-sm text-gray-600">
                    <p>
                      {t("likelihood")}: {r.residualLikelihood ?? "-"}
                    </p>
                    <p>
                      {t("impact")}: {r.residualImpact ?? "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial + Treatment + Review */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {t("financialImpactRange")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-gray-500">{t("financialMin")}:</span>{" "}
                  {formatCurrency(r.financialImpactMin)}
                </p>
                <p>
                  <span className="text-gray-500">{t("financialMax")}:</span>{" "}
                  {formatCurrency(r.financialImpactMax)}
                </p>
                <p>
                  <span className="text-gray-500">
                    {t("financialExpected")}:
                  </span>{" "}
                  {formatCurrency(r.financialImpactExpected)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {t("treatmentStrategy")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {r.treatmentStrategy ? (
                  <Badge className="text-sm px-3 py-1">
                    {t(`treatmentStrategies.${r.treatmentStrategy}`)}
                  </Badge>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("reviewDate")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={14} className="text-gray-400" />
                  <span>
                    {r.reviewDate
                      ? new Date(r.reviewDate).toLocaleDateString()
                      : "-"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ══════ Assessment Tab ══════ */}
        <TabsContent value="assessment" className="space-y-4 mt-4">
          {/* Heat map */}
          <Card>
            <CardContent className="flex justify-center py-6">
              <MiniHeatMap
                inherentL={r.inherentLikelihood}
                inherentI={r.inherentImpact}
                residualL={r.residualLikelihood}
                residualI={r.residualImpact}
              />
            </CardContent>
          </Card>

          {/* Score table */}
          <Card>
            <CardContent className="pt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="text-left py-2" />
                    <th className="text-center py-2">{t("likelihood")}</th>
                    <th className="text-center py-2">{t("impact")}</th>
                    <th className="text-center py-2">{t("score")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 font-medium">{t("inherent")}</td>
                    <td className="py-2 text-center">
                      {r.inherentLikelihood ?? "-"}
                    </td>
                    <td className="py-2 text-center">
                      {r.inherentImpact ?? "-"}
                    </td>
                    <td className="py-2 text-center">
                      <Badge className={iScore.color}>{iScore.label}</Badge>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">{t("residual")}</td>
                    <td className="py-2 text-center">
                      {r.residualLikelihood ?? "-"}
                    </td>
                    <td className="py-2 text-center">
                      {r.residualImpact ?? "-"}
                    </td>
                    <td className="py-2 text-center">
                      <Badge className={rScore.color}>{rScore.label}</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Appetite indicator */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">
                  {t("appetiteIndicator")}:
                </span>
                {r.riskAppetiteExceeded ? (
                  <span className="flex items-center gap-1 text-sm text-red-600">
                    <AlertTriangle size={14} />
                    {t("appetiteExceeded")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle2 size={14} />
                    {t("appetiteWithin")}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Edit Assessment */}
          {!editingAssessment ? (
            <button
              onClick={() => setEditingAssessment(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Pencil size={14} />
              {t("editAssessment")}
            </button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {t("editAssessment")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(["inherent", "residual"] as const).map((type) => (
                  <div key={type} className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">
                      {t(type)}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500">
                          {t("likelihood")}
                        </label>
                        <div className="flex gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((v) => (
                            <button
                              key={v}
                              onClick={() =>
                                setAssessmentForm((f) => ({
                                  ...f,
                                  [`${type}Likelihood`]: v,
                                }))
                              }
                              className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                                assessmentForm[
                                  `${type}Likelihood` as keyof typeof assessmentForm
                                ] === v
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">
                          {t("impact")}
                        </label>
                        <div className="flex gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((v) => (
                            <button
                              key={v}
                              onClick={() =>
                                setAssessmentForm((f) => ({
                                  ...f,
                                  [`${type}Impact`]: v,
                                }))
                              }
                              className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                                assessmentForm[
                                  `${type}Impact` as keyof typeof assessmentForm
                                ] === v
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={saveAssessment}
                    disabled={savingAssessment}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingAssessment && (
                      <Loader2 size={14} className="animate-spin" />
                    )}
                    {t("saveAssessment")}
                  </button>
                  <button
                    onClick={() => setEditingAssessment(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    {t("tabs.overview")}
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══════ Treatment Tab ══════ */}
        <TabsContent value="treatment" className="space-y-4 mt-4">
          {/* Strategy badge */}
          {r.treatmentStrategy && (
            <div className="flex items-center gap-3 mb-4">
              <Badge className="text-sm px-4 py-1.5">
                {t(`treatmentStrategies.${r.treatmentStrategy}`)}
              </Badge>
              {r.treatmentRationale && (
                <p className="text-sm text-gray-500 italic">
                  {r.treatmentRationale}
                </p>
              )}
            </div>
          )}

          {/* Treatment cards */}
          {r.treatments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Inbox size={32} className="mb-2" />
              <p className="text-sm">{t("noTreatments")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {r.treatments.map((tr) => {
                const isOverdue =
                  tr.dueDate &&
                  new Date(tr.dueDate) < new Date() &&
                  tr.status !== "completed" &&
                  tr.status !== "cancelled";

                return (
                  <Card
                    key={tr.id}
                    className={
                      isOverdue
                        ? "border-l-4 border-l-red-400"
                        : ""
                    }
                  >
                    <CardContent className="pt-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {tr.description}
                          </p>
                          <Badge className={treatmentStatusColors[tr.status]}>
                            {t(`treatmentStatuses.${tr.status}`)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                          {tr.responsibleName && (
                            <span className="flex items-center gap-1">
                              <User size={12} />
                              {tr.responsibleName}
                            </span>
                          )}
                          {tr.dueDate && (
                            <span
                              className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : ""}`}
                            >
                              <Calendar size={12} />
                              {new Date(tr.dueDate).toLocaleDateString()}
                              {isOverdue && ` (${t("treatmentOverdue")})`}
                            </span>
                          )}
                          {tr.costEstimate && (
                            <span>
                              {t("treatmentCost")}:{" "}
                              {formatCurrency(tr.costEstimate)}
                            </span>
                          )}
                          {tr.expectedRiskReduction && (
                            <span>
                              {t("treatmentExpectedReduction")}:{" "}
                              {tr.expectedRiskReduction}%
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Add treatment button + dialog */}
          <Dialog
            open={treatmentDialogOpen}
            onOpenChange={setTreatmentDialogOpen}
          >
            <DialogTrigger asChild>
              <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Plus size={14} />
                {t("addTreatment")}
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("addTreatment")}</DialogTitle>
                <DialogDescription>
                  {t("treatmentDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <textarea
                  value={treatmentForm.description}
                  onChange={(e) =>
                    setTreatmentForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  placeholder={t("treatmentDescription")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  rows={3}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={treatmentForm.dueDate}
                    onChange={(e) =>
                      setTreatmentForm((f) => ({
                        ...f,
                        dueDate: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    value={treatmentForm.costEstimate}
                    onChange={(e) =>
                      setTreatmentForm((f) => ({
                        ...f,
                        costEstimate: e.target.value,
                      }))
                    }
                    placeholder={t("treatmentCost")}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <select
                  value={treatmentForm.status}
                  onChange={(e) =>
                    setTreatmentForm((f) => ({
                      ...f,
                      status: e.target.value as TreatmentStatus,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {(
                    ["planned", "in_progress", "completed", "cancelled"] as const
                  ).map((s) => (
                    <option key={s} value={s}>
                      {t(`treatmentStatuses.${s}`)}
                    </option>
                  ))}
                </select>

                {/* Cost Tracking Section */}
                <div className="border-t border-gray-200 pt-3 mt-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    {t("costTracking.title")}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={treatmentForm.costAnnual}
                        onChange={(e) =>
                          setTreatmentForm((f) => ({
                            ...f,
                            costAnnual: e.target.value,
                          }))
                        }
                        placeholder={t("costTracking.costAnnual")}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-12 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        EUR
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={treatmentForm.effortHours}
                      onChange={(e) =>
                        setTreatmentForm((f) => ({
                          ...f,
                          effortHours: e.target.value,
                        }))
                      }
                      placeholder={t("costTracking.effortHours")}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <select
                    value={treatmentForm.budgetId}
                    onChange={(e) =>
                      setTreatmentForm((f) => ({
                        ...f,
                        budgetId: e.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">{t("costTracking.budgetPlaceholder")}</option>
                    {treatmentBudgets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.currency} {parseFloat(b.totalAmount).toLocaleString()})
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={treatmentForm.costNote}
                    onChange={(e) =>
                      setTreatmentForm((f) => ({
                        ...f,
                        costNote: e.target.value,
                      }))
                    }
                    placeholder={t("costTracking.costNotePlaceholder")}
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <button
                  onClick={addTreatment}
                  disabled={savingTreatment || !treatmentForm.description.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingTreatment && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  {t("addTreatment")}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ══════ KRIs Tab ══════ */}
        <TabsContent value="kris" className="space-y-4 mt-4">
          {krisLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : kris.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Activity size={32} className="mb-2" />
              <p className="text-sm">{t("noKris")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kris.map((k) => (
                <Card key={k.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{k.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${alertColors[k.currentAlertStatus]}`}
                        />
                        {trendIcon(k.trend)}
                      </div>
                    </div>
                    {k.linkedRiskName && (
                      <CardDescription className="text-xs">
                        {k.linkedRiskName}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-900">
                        {k.currentValue ?? "-"}
                      </span>
                      {k.unit && (
                        <span className="text-sm text-gray-400">{k.unit}</span>
                      )}
                    </div>

                    {/* Sparkline */}
                    {k.measurements && k.measurements.length > 0 && (
                      <KriSparkline
                        measurements={k.measurements}
                        alertStatus={k.currentAlertStatus}
                      />
                    )}

                    {/* Thresholds */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {k.thresholdGreen && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          {k.thresholdGreen}
                        </span>
                      )}
                      {k.thresholdYellow && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-yellow-400" />
                          {k.thresholdYellow}
                        </span>
                      )}
                      {k.thresholdRed && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          {k.thresholdRed}
                        </span>
                      )}
                    </div>

                    {/* Inline add measurement */}
                    {measKriId === k.id ? (
                      <div className="flex items-end gap-2 pt-2 border-t">
                        <input
                          type="number"
                          value={measForm.value}
                          onChange={(e) =>
                            setMeasForm((f) => ({
                              ...f,
                              value: e.target.value,
                            }))
                          }
                          placeholder={t("measurementValue")}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                        <input
                          type="text"
                          value={measForm.notes}
                          onChange={(e) =>
                            setMeasForm((f) => ({
                              ...f,
                              notes: e.target.value,
                            }))
                          }
                          placeholder={t("measurementNotes")}
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button
                          onClick={addMeasurement}
                          disabled={savingMeas || !measForm.value}
                          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingMeas ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            "+"
                          )}
                        </button>
                        <button
                          onClick={() => setMeasKriId(null)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-500"
                        >
                          x
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setMeasKriId(k.id)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        + {t("addMeasurement")}
                      </button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══════ Linkages Tab ══════ */}
        <TabsContent value="linkages" className="space-y-4 mt-4">
          {linkagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Framework Requirements */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {t("frameworkRequirements")}
                    </CardTitle>
                    <button className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                      <Plus size={12} />
                      {t("addFrameworkMapping")}
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  {frameworkMappings.length === 0 ? (
                    <p className="text-sm text-gray-400">{t("noLinkages")}</p>
                  ) : (
                    <div className="space-y-2">
                      {frameworkMappings.map((fm) => (
                        <div
                          key={fm.id}
                          className="flex items-center gap-2 text-sm text-gray-700 rounded-md bg-gray-50 px-3 py-2"
                        >
                          <FileText size={14} className="text-gray-400" />
                          <span className="font-mono text-xs">
                            {fm.requirementId?.slice(0, 8)}...
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Process Links */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {t("processLinks")}
                    </CardTitle>
                    <button className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                      <Plus size={12} />
                      {t("addProcessLink")}
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  {processLinks.length === 0 ? (
                    <p className="text-sm text-gray-400">{t("noLinkages")}</p>
                  ) : (
                    <div className="space-y-2">
                      {processLinks.map((pl) => (
                        <div
                          key={pl.id}
                          className="flex items-center gap-2 text-sm text-gray-700 rounded-md bg-gray-50 px-3 py-2"
                        >
                          <Link2 size={14} className="text-gray-400" />
                          <span className="font-mono text-xs">
                            {pl.processId?.slice(0, 8)}...
                          </span>
                          {pl.riskContext && (
                            <span className="text-gray-500 text-xs">
                              ({pl.riskContext})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Asset Links */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {t("assetLinks")}
                    </CardTitle>
                    <button className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                      <Plus size={12} />
                      {t("addAssetLink")}
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  {assetLinks.length === 0 ? (
                    <p className="text-sm text-gray-400">{t("noLinkages")}</p>
                  ) : (
                    <div className="space-y-2">
                      {assetLinks.map((al) => (
                        <div
                          key={al.id}
                          className="flex items-center gap-2 text-sm text-gray-700 rounded-md bg-gray-50 px-3 py-2"
                        >
                          <ExternalLink size={14} className="text-gray-400" />
                          <span className="font-mono text-xs">
                            {al.assetId?.slice(0, 8)}...
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ══════ History Tab ══════ */}
        <TabsContent value="history" className="space-y-4 mt-4">
          {auditLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : auditLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Clock size={32} className="mb-2" />
              <p className="text-sm">{t("noHistory")}</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
              <div className="space-y-4">
                {auditLog.map((entry) => {
                  const actionIcons = {
                    create: {
                      icon: Plus,
                      color: "text-green-600 bg-green-50",
                    },
                    update: {
                      icon: Pencil,
                      color: "text-blue-600 bg-blue-50",
                    },
                    delete: { icon: Trash2, color: "text-red-600 bg-red-50" },
                  };
                  const def =
                    actionIcons[entry.action] ?? actionIcons.update;
                  const ActionIcon = def.icon;

                  return (
                    <div key={entry.id} className="relative pl-10">
                      <div
                        className={`absolute left-2 top-1 p-1.5 rounded-md ${def.color}`}
                      >
                        <ActionIcon size={12} />
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-white p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">
                            {entry.userName ?? entry.userEmail ?? "System"}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {entry.action} {entry.entityType}
                          {entry.entityTitle && ` "${entry.entityTitle}"`}
                        </p>
                        {entry.changes &&
                          Object.keys(entry.changes).length > 0 && (
                            <div className="mt-2 space-y-1">
                              {Object.entries(entry.changes).map(
                                ([field, change]) => (
                                  <div
                                    key={field}
                                    className="text-xs text-gray-500"
                                  >
                                    <span className="font-medium">
                                      {field}
                                    </span>
                                    :{" "}
                                    <span className="line-through text-red-400">
                                      {String(change.old ?? "-")}
                                    </span>{" "}
                                    <span className="text-green-600">
                                      {String(change.new ?? "-")}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ══════ Documents Tab ══════ */}
        <TabsContent value="documents" className="space-y-4 mt-4">
          <EntityDocumentsPanel entityType="risk" entityId={riskId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page with ModuleGate
// ---------------------------------------------------------------------------

export default function RiskDetailPage() {
  return (
    <ModuleGate moduleKey="erm">
      <RiskDetailContent />
    </ModuleGate>
  );
}
