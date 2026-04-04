"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  User,
  Calendar,
  Clock,
  FileText,
  AlertTriangle,
  Activity,
  Link2,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { EntityDocumentsPanel } from "@/components/documents/entity-documents-panel";
import { ControlStatusBadge } from "@/components/control/control-status-badge";
import { FindingSeverityBadge } from "@/components/control/finding-severity-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type {
  Control,
  ControlTest,
  Finding,
  ControlStatus,
  ControlType,
  ControlAssertion,
  TestResult,
} from "@grc/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ControlDetail extends Control {
  ownerName?: string;
  ownerEmail?: string;
}

interface LinkedRisk {
  id: string;
  title: string;
  riskCategory: string;
  riskScoreResidual?: number;
  coverage?: string;
}

interface AuditLogEntry {
  id: string;
  userName: string | null;
  action: string;
  entityType: string;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertionBadgeClass(assertion: string): string {
  const map: Record<string, string> = {
    completeness: "bg-blue-100 text-blue-800 border-blue-200",
    accuracy: "bg-emerald-100 text-emerald-800 border-emerald-200",
    obligations_and_rights: "bg-violet-100 text-violet-800 border-violet-200",
    fraud_prevention: "bg-red-100 text-red-800 border-red-200",
    existence: "bg-indigo-100 text-indigo-800 border-indigo-200",
    valuation: "bg-amber-100 text-amber-800 border-amber-200",
    presentation: "bg-cyan-100 text-cyan-800 border-cyan-200",
    safeguarding_of_assets: "bg-teal-100 text-teal-800 border-teal-200",
  };
  return map[assertion] ?? "bg-gray-100 text-gray-600 border-gray-200";
}

function testResultBadge(result?: TestResult): { className: string; label: string } {
  const map: Record<string, { className: string; label: string }> = {
    effective: { className: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Effective" },
    ineffective: { className: "bg-red-100 text-red-800 border-red-200", label: "Ineffective" },
    partially_effective: { className: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Partially Effective" },
    not_tested: { className: "bg-gray-100 text-gray-600 border-gray-200", label: "Not Tested" },
  };
  if (!result) return map.not_tested;
  return map[result] ?? map.not_tested;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString();
}

function coverageClass(coverage?: string): string {
  const map: Record<string, string> = {
    full: "bg-emerald-500",
    partial: "bg-yellow-500",
    planned: "bg-blue-500",
    none: "bg-red-500",
  };
  return map[coverage ?? "none"] ?? "bg-gray-400";
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ControlDetailPage() {
  return (
    <ModuleGate moduleKey="ics">
      <ControlDetailInner />
    </ModuleGate>
  );
}

function ControlDetailInner() {
  const t = useTranslations("controls");
  const tFindings = useTranslations("findings");
  const params = useParams();
  const router = useRouter();
  const controlId = params.id as string;

  const [control, setControl] = useState<ControlDetail | null>(null);
  const [tests, setTests] = useState<ControlTest[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [linkedRisks, setLinkedRisks] = useState<LinkedRisk[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [controlRes, testsRes, findingsRes, rcmRes, logRes] = await Promise.all([
        fetch(`/api/v1/controls/${controlId}`),
        fetch(`/api/v1/controls/${controlId}/tests`),
        fetch(`/api/v1/controls/${controlId}/findings`),
        fetch(`/api/v1/controls/${controlId}/rcm`),
        fetch(`/api/v1/audit-log?entityType=control&entityId=${controlId}&limit=50`),
      ]);

      if (controlRes.ok) {
        const json = await controlRes.json();
        setControl(json.data ?? null);
      }
      if (testsRes.ok) {
        const json = await testsRes.json();
        setTests(json.data ?? []);
      }
      if (findingsRes.ok) {
        const json = await findingsRes.json();
        setFindings(json.data ?? []);
      }
      if (rcmRes.ok) {
        const json = await rcmRes.json();
        setLinkedRisks(json.data ?? []);
      }
      if (logRes.ok) {
        const json = await logRes.json();
        setAuditLog(json.data ?? []);
      }
    } catch {
      // error states handled by null checks
    } finally {
      setLoading(false);
    }
  }, [controlId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!control) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/controls")}>
          <ArrowLeft size={16} />
          {t("backToList")}
        </Button>
        <div className="flex flex-col items-center justify-center py-12">
          <ShieldCheck size={32} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">{t("notFound")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/controls")}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{control.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <ControlStatusBadge status={control.status} />
              <Badge
                variant="outline"
                className="bg-blue-100 text-blue-800 border-blue-200 text-xs"
              >
                {t(`type.${control.controlType}`)}
              </Badge>
              <span className="text-sm text-gray-500">
                {t(`frequency.${control.frequency}`)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="tests">{t("tabs.tests")}</TabsTrigger>
          <TabsTrigger value="findings">
            {t("tabs.findings")}
            {findings.length > 0 && (
              <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                {findings.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rcm">{t("tabs.rcm")}</TabsTrigger>
          <TabsTrigger value="history">{t("tabs.history")}</TabsTrigger>
          <TabsTrigger value="documents">
            <FileText size={14} className="mr-1.5" />
            {t("tabs.documents")}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">{t("tabs.overview")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {control.description && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">{t("form.description")}</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{control.description}</p>
                  </div>
                )}
                {control.objective && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">{t("form.objective")}</p>
                    <p className="text-sm text-gray-700">{control.objective}</p>
                  </div>
                )}
                {control.testInstructions && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">{t("form.testInstructions")}</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{control.testInstructions}</p>
                  </div>
                )}

                {/* Assertions COSO Badges */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">{t("assertions.title")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(control.assertions ?? []).map((a) => (
                      <Badge
                        key={a}
                        variant="outline"
                        className={assertionBadgeClass(a)}
                      >
                        {t(`assertions.${a}`)}
                      </Badge>
                    ))}
                    {(control.assertions ?? []).length === 0 && (
                      <span className="text-xs text-gray-400">{"\u2014"}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metadata sidebar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("metadata")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-gray-400" />
                  <span className="text-gray-500">{t("form.owner")}:</span>
                  <span className="font-medium text-gray-700">
                    {control.ownerName ?? "\u2014"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-gray-400" />
                  <span className="text-gray-500">{t("form.automation")}:</span>
                  <span className="font-medium text-gray-700">
                    {t(`automation.${control.automationLevel}`)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-gray-400" />
                  <span className="text-gray-500">{t("form.frequency")}:</span>
                  <span className="font-medium text-gray-700">
                    {t(`frequency.${control.frequency}`)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <span className="text-gray-500">{t("form.reviewDate")}:</span>
                  <span className="font-medium text-gray-700">
                    {formatDate(control.reviewDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-gray-400" />
                  <span className="text-gray-500">{t("form.createdAt")}:</span>
                  <span className="font-medium text-gray-700">
                    {formatDate(control.createdAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tests Tab */}
        <TabsContent value="tests" className="mt-4">
          {tests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <FileText size={28} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">{t("tests.empty")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tests.map((test) => {
                const todBadge = testResultBadge(test.todResult);
                const toeBadge = testResultBadge(test.toeResult);
                return (
                  <Card key={test.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {t(`tests.type.${test.testType}`)}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-slate-100 text-slate-600 border-slate-200"
                            >
                              {t(`tests.status.${test.status}`)}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500">
                            {formatDate(test.testDate)}
                            {test.sampleSize && ` | ${t("tests.sampleSize")}: ${test.sampleSize}`}
                          </p>
                          {test.conclusion && (
                            <p className="text-xs text-gray-600 mt-1">{test.conclusion}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <p className="text-[10px] font-medium text-gray-400 mb-0.5">ToD</p>
                            <Badge variant="outline" className={todBadge.className}>
                              {todBadge.label}
                            </Badge>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] font-medium text-gray-400 mb-0.5">ToE</p>
                            <Badge variant="outline" className={toeBadge.className}>
                              {toeBadge.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Findings Tab */}
        <TabsContent value="findings" className="mt-4">
          {findings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <AlertTriangle size={28} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">{t("findings.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {findings.map((f) => (
                <Link
                  key={f.id}
                  href={`/controls/findings/${f.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FindingSeverityBadge severity={f.severity} />
                    <span className="text-sm font-medium text-gray-900">{f.title}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs bg-gray-100 text-gray-600 border-gray-200"
                  >
                    {tFindings(`status.${f.status}`)}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* RCM Tab */}
        <TabsContent value="rcm" className="mt-4">
          {linkedRisks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <Link2 size={28} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">{t("rcm.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {linkedRisks.map((risk) => (
                <Link
                  key={risk.id}
                  href={`/risks/${risk.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900">{risk.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {risk.riskCategory}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {risk.riskScoreResidual != null && (
                      <span className="text-xs font-mono text-gray-500">
                        Score: {risk.riskScoreResidual}
                      </span>
                    )}
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${coverageClass(risk.coverage)}`}
                      title={risk.coverage ?? "none"}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          {auditLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-12">
              <Activity size={28} className="text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">{t("history.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <Activity size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{entry.userName ?? "System"}</span>
                      {" "}
                      <span className="text-gray-500">{entry.action}</span>
                    </p>
                    {entry.changes && (
                      <div className="mt-1 text-xs text-gray-500">
                        {Object.entries(entry.changes).map(([key, val]) => (
                          <p key={key}>
                            <span className="font-mono">{key}</span>:{" "}
                            <span className="line-through text-red-400">{String(val.old ?? "\u2014")}</span>
                            {" -> "}
                            <span className="text-emerald-600">{String(val.new ?? "\u2014")}</span>
                          </p>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">{formatDate(entry.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-4">
          <EntityDocumentsPanel entityType="control" entityId={controlId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
