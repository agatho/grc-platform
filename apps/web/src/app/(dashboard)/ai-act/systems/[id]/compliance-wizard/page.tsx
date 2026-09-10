"use client";

import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileCheck,
  Eye,
  Gavel,
  Radio,
  Database,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslations } from "next-intl";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Der groesste Einzelblock des
 * Punktes (738 Zeilen) und durchgehend Mischtext: "Fuehrt alle relevanten
 * Compliance-Checks gegen das AI-System aus", "Training-Daten-Beschreibung
 * vorhanden", "Logs exportierbar fuer Behoerden".
 *
 * `statusPill` steht ausserhalb der Komponente und nimmt die
 * Uebersetzungsfunktion jetzt als Parameter. Die neun Anhang-IV-Abschnitte
 * fuehren nur noch ihren Schluessel; die Beschriftung kommt ueber ein
 * Template aus dem Katalog.
 */

/** Die Uebersetzungsfunktion, wie sie `statusPill` braucht. */
type Translate = (key: string) => string;
type CheckStatus = "not_run" | "running" | "pass" | "fail" | "warning";

interface CheckResult {
  status: CheckStatus;
  score?: number;
  missing?: string[];
  warnings?: string[];
  raw?: Record<string, unknown>;
}

function statusPill(status: CheckStatus, t: Translate) {
  if (status === "pass") {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-100 text-emerald-800 border-emerald-300"
      >
        <CheckCircle2 className="h-3 w-3 mr-1" />
        {t("systemWizard.status.pass")}
      </Badge>
    );
  }
  if (status === "fail") {
    return (
      <Badge
        variant="outline"
        className="bg-red-100 text-red-800 border-red-300"
      >
        <XCircle className="h-3 w-3 mr-1" />
        {t("systemWizard.status.fail")}
      </Badge>
    );
  }
  if (status === "warning") {
    return (
      <Badge
        variant="outline"
        className="bg-amber-100 text-amber-800 border-amber-300"
      >
        <AlertTriangle className="h-3 w-3 mr-1" />
        {t("systemWizard.status.warning")}
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge variant="outline">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        {t("systemWizard.status.running")}
      </Badge>
    );
  }
  return <Badge variant="outline">{t("systemWizard.status.not_run")}</Badge>;
}

export default function ComplianceWizardPage() {
  const t = useTranslations("aiAct");
  const { id } = useParams<{ id: string }>();

  // ─── Data Governance ──────────────────────────────────────
  const [dg, setDg] = useState({
    hasTrainingDataDescription: false,
    hasDataCollectionProcess: false,
    hasLabelingProcess: false,
    hasDataCleaningSteps: false,
    datasetSize: 0,
    hasDemographicCoverage: false,
    hasBiasTestingDone: false,
    hasDataProvenance: false,
    hasLegalBasisForTraining: false,
  });
  const [dgResult, setDgResult] = useState<CheckResult>({ status: "not_run" });

  // ─── Annex IV ────────────────────────────────────────────
  const [annexIv, setAnnexIv] = useState({
    section1_GeneralDescription: "",
    section2_DetailedElements: "",
    section3_Monitoring: "",
    section4_PerformanceMetrics: "",
    section5_RiskManagement: "",
    section6_LifecycleChanges: "",
    section7_HarmonisedStandards: "",
    section8_DeclarationOfConformity: "",
    section9_PostMarketMonitoring: "",
  });
  const [annexIvResult, setAnnexIvResult] = useState<CheckResult>({
    status: "not_run",
  });

  // ─── Logging ─────────────────────────────────────────────
  const [logging, setLogging] = useState({
    hasAutomaticLogging: false,
    logRetentionDays: 180,
    tamperEvidentStorage: false,
    logsExportable: false,
    includeInput: true,
    includeOutput: true,
    includeIncident: true,
  });
  const [loggingResult, setLoggingResult] = useState<CheckResult>({
    status: "not_run",
  });

  // ─── Oversight ───────────────────────────────────────────
  const [oversight, setOversight] = useState({
    hasUnderstandableOutputs: false,
    hasOverrideCapability: false,
    hasStopFunction: false,
    hasAutomationBiasTraining: false,
    hasDefinedRoles: false,
    assignedOversightPersonnel: 2,
  });
  const [oversightResult, setOversightResult] = useState<CheckResult>({
    status: "not_run",
  });

  // ─── CE Marking Gate ─────────────────────────────────────
  const [ceGate, setCeGate] = useState({
    procedure: "annex_vi" as "annex_vi" | "annex_vii",
    hasSignedDeclarationOfConformity: false,
    annexIvSectionsCompleted: 0,
    hasNotifiedBodyCertificate: false,
    registeredInEuDatabase: false,
    hasPostMarketMonitoringPlan: false,
  });
  const [ceResult, setCeResult] = useState<CheckResult>({ status: "not_run" });

  const runCheck = useCallback(
    async (
      endpoint: string,
      body: Record<string, unknown>,
      setResult: (r: CheckResult) => void,
      extractStatus: (data: Record<string, unknown>) => CheckStatus,
    ) => {
      setResult({ status: "running" });
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.text();
          setResult({
            status: "fail",
            warnings: [t("systemWizard.apiError", { status: res.status, err })],
          });
          return;
        }
        const { data } = (await res.json()) as {
          data: Record<string, unknown>;
        };
        setResult({
          status: extractStatus(data),
          score:
            typeof data.completenessPercent === "number"
              ? data.completenessPercent
              : typeof data.coveragePercent === "number"
                ? data.coveragePercent
                : typeof data.compliancePercent === "number"
                  ? data.compliancePercent
                  : undefined,
          missing: Array.isArray(data.missing)
            ? (data.missing as string[])
            : Array.isArray(data.missingCategories)
              ? (data.missingCategories as string[])
              : Array.isArray(data.missingSections)
                ? (data.missingSections as string[])
                : Array.isArray(data.blockers)
                  ? (data.blockers as string[])
                  : undefined,
          warnings: Array.isArray(data.warnings)
            ? (data.warnings as string[])
            : Array.isArray(data.issues)
              ? (data.issues as string[])
              : undefined,
          raw: data,
        });
      } catch (e) {
        setResult({
          status: "fail",
          warnings: [
            e instanceof Error ? e.message : t("systemWizard.networkError"),
          ],
        });
      }
    },
    [t],
  );

  const runDg = () =>
    runCheck(
      `/api/v1/ai-act/systems/${id}/data-governance-check`,
      { ...dg, datasetSize: dg.datasetSize || null, biasTestResults: null },
      setDgResult,
      (data) =>
        data.readyForHighRisk
          ? "pass"
          : (data.hasCriticalGaps as boolean)
            ? "fail"
            : "warning",
    );

  const runAnnexIv = () =>
    runCheck(
      `/api/v1/ai-act/systems/${id}/annex-iv-check`,
      annexIv,
      setAnnexIvResult,
      (data) => (data.readyForSubmission ? "pass" : "warning"),
    );

  const runLogging = () => {
    const categories = [];
    if (logging.includeInput) categories.push("input_data");
    if (logging.includeOutput) categories.push("output_decision");
    if (logging.includeIncident) categories.push("incident");
    categories.push(
      "user_interaction",
      "performance_metric",
      "model_version_change",
    );
    return runCheck(
      `/api/v1/ai-act/systems/${id}/logging-check`,
      { ...logging, loggedCategories: categories },
      setLoggingResult,
      (data) => (data.meetsMinimumRequirement ? "pass" : "fail"),
    );
  };

  const runOversight = () =>
    runCheck(
      `/api/v1/ai-act/systems/${id}/oversight-check`,
      { ...oversight, oversightFrequency: "periodic" },
      setOversightResult,
      (data) => {
        const design = data.design as { isAdequate: boolean };
        return design?.isAdequate ? "pass" : "fail";
      },
    );

  const runCe = () =>
    runCheck(
      `/api/v1/ai-act/systems/${id}/ce-marking-gate`,
      ceGate,
      setCeResult,
      (data) => (data.canAffixCeMarking ? "pass" : "fail"),
    );

  const runAll = async () => {
    await Promise.all([
      runDg(),
      runAnnexIv(),
      runLogging(),
      runOversight(),
      runCe(),
    ]);
  };

  const section = (
    title: string,
    description: string,
    icon: typeof Database,
    result: CheckResult,
    onRun: () => void,
    children: React.ReactNode,
  ) => {
    const Icon = icon;
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {statusPill(result.status, t)}
              <Button
                size="sm"
                onClick={onRun}
                disabled={result.status === "running"}
              >
                {t("systemWizard.check")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          {result.status !== "not_run" && result.status !== "running" && (
            <div className="border-t pt-3 space-y-2">
              {typeof result.score === "number" && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{t("systemWizard.coverage")}</span>
                    <span className="font-medium">{result.score}%</span>
                  </div>
                  <Progress value={result.score} className="h-2" />
                </div>
              )}
              {result.missing && result.missing.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("systemWizard.missing")}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {result.missing.map((m, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {result.warnings && result.warnings.length > 0 && (
                <ul className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-amber-700"
                    >
                      <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const boolRow = (
    key: string,
    label: string,
    value: boolean,
    onChange: (v: boolean) => void,
  ) => (
    <div className="flex items-center justify-between" key={key}>
      <Label htmlFor={key} className="text-xs cursor-pointer flex-1">
        {label}
      </Label>
      <Switch id={key} checked={value} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/ai-act/systems/${id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("systemWizard.backToSystem")}
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("systemWizard.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("systemWizard.description")}
          </p>
        </div>
        <Button onClick={runAll}>
          <FileCheck className="h-4 w-4 mr-2" />
          {t("systemWizard.runAll")}
        </Button>
      </div>

      {/* Section 1: Data Governance */}
      {section(
        t("systemWizard.dg.title"),
        t("systemWizard.dg.description"),
        Database,
        dgResult,
        runDg,
        <div className="grid md:grid-cols-2 gap-2">
          {boolRow(
            "dg-desc",
            t("systemWizard.dg.trainingDataDescription"),
            dg.hasTrainingDataDescription,
            (v) => setDg({ ...dg, hasTrainingDataDescription: v }),
          )}
          {boolRow(
            "dg-coll",
            t("systemWizard.dg.collectionProcess"),
            dg.hasDataCollectionProcess,
            (v) => setDg({ ...dg, hasDataCollectionProcess: v }),
          )}
          {boolRow(
            "dg-lab",
            t("systemWizard.dg.labelingProcess"),
            dg.hasLabelingProcess,
            (v) => setDg({ ...dg, hasLabelingProcess: v }),
          )}
          {boolRow(
            "dg-clean",
            t("systemWizard.dg.cleaningSteps"),
            dg.hasDataCleaningSteps,
            (v) => setDg({ ...dg, hasDataCleaningSteps: v }),
          )}
          {boolRow(
            "dg-demo",
            t("systemWizard.dg.demographicCoverage"),
            dg.hasDemographicCoverage,
            (v) => setDg({ ...dg, hasDemographicCoverage: v }),
          )}
          {boolRow(
            "dg-bias",
            t("systemWizard.dg.biasTesting"),
            dg.hasBiasTestingDone,
            (v) => setDg({ ...dg, hasBiasTestingDone: v }),
          )}
          {boolRow(
            "dg-prov",
            t("systemWizard.dg.provenance"),
            dg.hasDataProvenance,
            (v) => setDg({ ...dg, hasDataProvenance: v }),
          )}
          {boolRow(
            "dg-legal",
            t("systemWizard.dg.legalBasis"),
            dg.hasLegalBasisForTraining,
            (v) => setDg({ ...dg, hasLegalBasisForTraining: v }),
          )}
          <div className="col-span-2">
            <Label htmlFor="dg-size" className="text-xs">
              {t("systemWizard.dg.datasetSize")}
            </Label>
            <Input
              id="dg-size"
              type="number"
              min="0"
              value={dg.datasetSize}
              onChange={(e) =>
                setDg({ ...dg, datasetSize: parseInt(e.target.value) || 0 })
              }
              className="h-8"
            />
          </div>
        </div>,
      )}

      {/* Section 2: Annex IV */}
      {section(
        t("systemWizard.annexIv.title"),
        t("systemWizard.annexIv.description"),
        FileText,
        annexIvResult,
        runAnnexIv,
        <div className="space-y-3">
          {(
            [
              "section1_GeneralDescription",
              "section2_DetailedElements",
              "section3_Monitoring",
              "section4_PerformanceMetrics",
              "section5_RiskManagement",
              "section6_LifecycleChanges",
              "section7_HarmonisedStandards",
              "section8_DeclarationOfConformity",
              "section9_PostMarketMonitoring",
            ] as const
          ).map((key) => {
            const v = annexIv[key as keyof typeof annexIv];
            const charCount = v.length;
            const ok = charCount >= 200;
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-xs">
                    {t(`systemWizard.annexIv.${key}`)}
                  </Label>
                  <span
                    className={`text-xs font-mono ${ok ? "text-emerald-600" : "text-muted-foreground"}`}
                  >
                    {charCount}/200
                  </span>
                </div>
                <Textarea
                  rows={2}
                  value={v}
                  onChange={(e) =>
                    setAnnexIv({ ...annexIv, [key]: e.target.value })
                  }
                  className="text-xs"
                />
              </div>
            );
          })}
        </div>,
      )}

      {/* Section 3: Logging */}
      {section(
        t("systemWizard.logging.title"),
        t("systemWizard.logging.description"),
        Radio,
        loggingResult,
        runLogging,
        <div className="grid md:grid-cols-2 gap-2">
          {boolRow(
            "log-auto",
            t("systemWizard.logging.automatic"),
            logging.hasAutomaticLogging,
            (v) => setLogging({ ...logging, hasAutomaticLogging: v }),
          )}
          {boolRow(
            "log-tamper",
            t("systemWizard.logging.tamperEvident"),
            logging.tamperEvidentStorage,
            (v) => setLogging({ ...logging, tamperEvidentStorage: v }),
          )}
          {boolRow(
            "log-export",
            t("systemWizard.logging.exportable"),
            logging.logsExportable,
            (v) => setLogging({ ...logging, logsExportable: v }),
          )}
          {boolRow(
            "log-input",
            t("systemWizard.logging.input"),
            logging.includeInput,
            (v) => setLogging({ ...logging, includeInput: v }),
          )}
          {boolRow(
            "log-output",
            t("systemWizard.logging.output"),
            logging.includeOutput,
            (v) => setLogging({ ...logging, includeOutput: v }),
          )}
          {boolRow(
            "log-incident",
            t("systemWizard.logging.incident"),
            logging.includeIncident,
            (v) => setLogging({ ...logging, includeIncident: v }),
          )}
          <div className="col-span-2">
            <Label htmlFor="log-retention" className="text-xs">
              {t("systemWizard.logging.retention")}
            </Label>
            <Input
              id="log-retention"
              type="number"
              min="0"
              value={logging.logRetentionDays}
              onChange={(e) =>
                setLogging({
                  ...logging,
                  logRetentionDays: parseInt(e.target.value) || 0,
                })
              }
              className="h-8"
            />
          </div>
        </div>,
      )}

      {/* Section 4: Oversight */}
      {section(
        t("systemWizard.oversight.title"),
        t("systemWizard.oversight.description"),
        Eye,
        oversightResult,
        runOversight,
        <div className="grid md:grid-cols-2 gap-2">
          {boolRow(
            "ov-outputs",
            t("systemWizard.oversight.understandableOutputs"),
            oversight.hasUnderstandableOutputs,
            (v) => setOversight({ ...oversight, hasUnderstandableOutputs: v }),
          )}
          {boolRow(
            "ov-override",
            t("systemWizard.oversight.override"),
            oversight.hasOverrideCapability,
            (v) => setOversight({ ...oversight, hasOverrideCapability: v }),
          )}
          {boolRow(
            "ov-stop",
            t("systemWizard.oversight.stopFunction"),
            oversight.hasStopFunction,
            (v) => setOversight({ ...oversight, hasStopFunction: v }),
          )}
          {boolRow(
            "ov-bias",
            t("systemWizard.oversight.automationBiasTraining"),
            oversight.hasAutomationBiasTraining,
            (v) => setOversight({ ...oversight, hasAutomationBiasTraining: v }),
          )}
          {boolRow(
            "ov-roles",
            t("systemWizard.oversight.definedRoles"),
            oversight.hasDefinedRoles,
            (v) => setOversight({ ...oversight, hasDefinedRoles: v }),
          )}
          <div className="col-span-2">
            <Label htmlFor="ov-personnel" className="text-xs">
              {t("systemWizard.oversight.personnel")}
            </Label>
            <Input
              id="ov-personnel"
              type="number"
              min="0"
              value={oversight.assignedOversightPersonnel}
              onChange={(e) =>
                setOversight({
                  ...oversight,
                  assignedOversightPersonnel: parseInt(e.target.value) || 0,
                })
              }
              className="h-8"
            />
          </div>
        </div>,
      )}

      {/* Section 5: CE Marking Gate */}
      {section(
        t("systemWizard.ce.title"),
        t("systemWizard.ce.description"),
        Gavel,
        ceResult,
        runCe,
        <div className="grid md:grid-cols-2 gap-2">
          <div className="col-span-2">
            <Label htmlFor="ce-procedure" className="text-xs">
              {t("systemWizard.ce.procedure")}
            </Label>
            <select
              id="ce-procedure"
              className="w-full h-8 border rounded px-2 text-sm"
              value={ceGate.procedure}
              onChange={(e) =>
                setCeGate({
                  ...ceGate,
                  procedure: e.target.value as "annex_vi" | "annex_vii",
                })
              }
            >
              <option value="annex_vi">{t("systemWizard.ce.annexVi")}</option>
              <option value="annex_vii">{t("systemWizard.ce.annexVii")}</option>
            </select>
          </div>
          {boolRow(
            "ce-doc",
            t("systemWizard.ce.declarationSigned"),
            ceGate.hasSignedDeclarationOfConformity,
            (v) =>
              setCeGate({ ...ceGate, hasSignedDeclarationOfConformity: v }),
          )}
          {boolRow(
            "ce-nb",
            t("systemWizard.ce.notifiedBodyCertificate"),
            ceGate.hasNotifiedBodyCertificate,
            (v) => setCeGate({ ...ceGate, hasNotifiedBodyCertificate: v }),
          )}
          {boolRow(
            "ce-eudb",
            t("systemWizard.ce.euDatabase"),
            ceGate.registeredInEuDatabase,
            (v) => setCeGate({ ...ceGate, registeredInEuDatabase: v }),
          )}
          {boolRow(
            "ce-pmm",
            t("systemWizard.ce.postMarketPlan"),
            ceGate.hasPostMarketMonitoringPlan,
            (v) => setCeGate({ ...ceGate, hasPostMarketMonitoringPlan: v }),
          )}
          <div className="col-span-2">
            <Label htmlFor="ce-annex" className="text-xs">
              {t("systemWizard.ce.annexIvComplete")}
            </Label>
            <Input
              id="ce-annex"
              type="number"
              min="0"
              max="9"
              value={ceGate.annexIvSectionsCompleted}
              onChange={(e) =>
                setCeGate({
                  ...ceGate,
                  annexIvSectionsCompleted: Math.min(
                    9,
                    Math.max(0, parseInt(e.target.value) || 0),
                  ),
                })
              }
              className="h-8"
            />
          </div>
        </div>,
      )}
    </div>
  );
}
