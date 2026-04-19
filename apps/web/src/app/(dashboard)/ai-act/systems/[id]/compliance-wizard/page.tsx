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
  Shield,
  Eye,
  FlaskConical,
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

type CheckStatus = "not_run" | "running" | "pass" | "fail" | "warning";

interface CheckResult {
  status: CheckStatus;
  score?: number;
  missing?: string[];
  warnings?: string[];
  raw?: Record<string, unknown>;
}

function statusPill(status: CheckStatus) {
  if (status === "pass") {
    return (
      <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Pass
      </Badge>
    );
  }
  if (status === "fail") {
    return (
      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
        <XCircle className="h-3 w-3 mr-1" />
        Fail
      </Badge>
    );
  }
  if (status === "warning") {
    return (
      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Warnung
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge variant="outline">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Laeuft...
      </Badge>
    );
  }
  return <Badge variant="outline">Nicht ausgefuehrt</Badge>;
}

export default function ComplianceWizardPage() {
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
  const [annexIvResult, setAnnexIvResult] = useState<CheckResult>({ status: "not_run" });

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
  const [loggingResult, setLoggingResult] = useState<CheckResult>({ status: "not_run" });

  // ─── Oversight ───────────────────────────────────────────
  const [oversight, setOversight] = useState({
    hasUnderstandableOutputs: false,
    hasOverrideCapability: false,
    hasStopFunction: false,
    hasAutomationBiasTraining: false,
    hasDefinedRoles: false,
    assignedOversightPersonnel: 2,
  });
  const [oversightResult, setOversightResult] = useState<CheckResult>({ status: "not_run" });

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
          setResult({ status: "fail", warnings: [`API error ${res.status}: ${err}`] });
          return;
        }
        const { data } = (await res.json()) as { data: Record<string, unknown> };
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
          warnings: [e instanceof Error ? e.message : "Netzwerkfehler"],
        });
      }
    },
    [],
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
    categories.push("user_interaction", "performance_metric", "model_version_change");
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
    await Promise.all([runDg(), runAnnexIv(), runLogging(), runOversight(), runCe()]);
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
              {statusPill(result.status)}
              <Button size="sm" onClick={onRun} disabled={result.status === "running"}>
                Pruefen
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
                    <span>Coverage</span>
                    <span className="font-medium">{result.score}%</span>
                  </div>
                  <Progress value={result.score} className="h-2" />
                </div>
              )}
              {result.missing && result.missing.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Fehlend:</p>
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
                    <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
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
            Zurueck zu System
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">AI-Act Compliance Wizard</h1>
          <p className="text-muted-foreground mt-1">
            Fuehrt alle relevanten Compliance-Checks gegen das AI-System aus: Art. 10
            Data-Governance, Art. 11 Annex IV, Art. 12 Logging, Art. 14 Oversight, Art. 43
            CE-Marking-Gate.
          </p>
        </div>
        <Button onClick={runAll}>
          <FileCheck className="h-4 w-4 mr-2" />
          Alle Checks ausfuehren
        </Button>
      </div>

      {/* Section 1: Data Governance */}
      {section(
        "Art. 10 Data-Governance",
        "Training-Daten-Qualitaet, Bias-Testing, Provenance + Legal-Basis.",
        Database,
        dgResult,
        runDg,
        <div className="grid md:grid-cols-2 gap-2">
          {boolRow(
            "dg-desc",
            "Training-Daten-Beschreibung vorhanden",
            dg.hasTrainingDataDescription,
            (v) => setDg({ ...dg, hasTrainingDataDescription: v }),
          )}
          {boolRow("dg-coll", "Daten-Erhebungsprozess dokumentiert", dg.hasDataCollectionProcess, (v) =>
            setDg({ ...dg, hasDataCollectionProcess: v }),
          )}
          {boolRow("dg-lab", "Labeling-Prozess dokumentiert", dg.hasLabelingProcess, (v) =>
            setDg({ ...dg, hasLabelingProcess: v }),
          )}
          {boolRow("dg-clean", "Data-Cleaning Steps dokumentiert", dg.hasDataCleaningSteps, (v) =>
            setDg({ ...dg, hasDataCleaningSteps: v }),
          )}
          {boolRow("dg-demo", "Demographische Abdeckung analysiert", dg.hasDemographicCoverage, (v) =>
            setDg({ ...dg, hasDemographicCoverage: v }),
          )}
          {boolRow("dg-bias", "Bias-Testing durchgefuehrt", dg.hasBiasTestingDone, (v) =>
            setDg({ ...dg, hasBiasTestingDone: v }),
          )}
          {boolRow("dg-prov", "Data-Provenance dokumentiert", dg.hasDataProvenance, (v) =>
            setDg({ ...dg, hasDataProvenance: v }),
          )}
          {boolRow(
            "dg-legal",
            "Rechtsgrundlage fuer Training",
            dg.hasLegalBasisForTraining,
            (v) => setDg({ ...dg, hasLegalBasisForTraining: v }),
          )}
          <div className="col-span-2">
            <Label htmlFor="dg-size" className="text-xs">
              Dataset-Groesse (Anzahl Datensaetze)
            </Label>
            <Input
              id="dg-size"
              type="number"
              min="0"
              value={dg.datasetSize}
              onChange={(e) => setDg({ ...dg, datasetSize: parseInt(e.target.value) || 0 })}
              className="h-8"
            />
          </div>
        </div>,
      )}

      {/* Section 2: Annex IV */}
      {section(
        "Art. 11 + Annex IV Technical Documentation",
        "9 Sections mit je mindestens 200 Zeichen.",
        FileText,
        annexIvResult,
        runAnnexIv,
        <div className="space-y-3">
          {(
            [
              ["section1_GeneralDescription", "Section 1: General description"],
              ["section2_DetailedElements", "Section 2: Detailed elements + dev process"],
              ["section3_Monitoring", "Section 3: Monitoring + functioning"],
              ["section4_PerformanceMetrics", "Section 4: Performance metrics"],
              ["section5_RiskManagement", "Section 5: Risk management system"],
              ["section6_LifecycleChanges", "Section 6: Lifecycle changes"],
              ["section7_HarmonisedStandards", "Section 7: Harmonised standards"],
              ["section8_DeclarationOfConformity", "Section 8: DoC copy"],
              ["section9_PostMarketMonitoring", "Section 9: Post-market monitoring"],
            ] as const
          ).map(([key, label]) => {
            const v = annexIv[key as keyof typeof annexIv];
            const charCount = v.length;
            const ok = charCount >= 200;
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-xs">{label}</Label>
                  <span
                    className={`text-xs font-mono ${ok ? "text-emerald-600" : "text-muted-foreground"}`}
                  >
                    {charCount}/200
                  </span>
                </div>
                <Textarea
                  rows={2}
                  value={v}
                  onChange={(e) => setAnnexIv({ ...annexIv, [key]: e.target.value })}
                  className="text-xs"
                />
              </div>
            );
          })}
        </div>,
      )}

      {/* Section 3: Logging */}
      {section(
        "Art. 12 Automatic Logging",
        "Auto-Logging + 180d Retention + Tamper-Evidenz + Export.",
        Radio,
        loggingResult,
        runLogging,
        <div className="grid md:grid-cols-2 gap-2">
          {boolRow(
            "log-auto",
            "Automatisches Logging aktiv",
            logging.hasAutomaticLogging,
            (v) => setLogging({ ...logging, hasAutomaticLogging: v }),
          )}
          {boolRow(
            "log-tamper",
            "Tamper-evident (Hash-Chain / WORM)",
            logging.tamperEvidentStorage,
            (v) => setLogging({ ...logging, tamperEvidentStorage: v }),
          )}
          {boolRow("log-export", "Logs exportierbar fuer Behoerden", logging.logsExportable, (v) =>
            setLogging({ ...logging, logsExportable: v }),
          )}
          {boolRow("log-input", "Input-Daten geloggt", logging.includeInput, (v) =>
            setLogging({ ...logging, includeInput: v }),
          )}
          {boolRow("log-output", "Output-Entscheidungen geloggt", logging.includeOutput, (v) =>
            setLogging({ ...logging, includeOutput: v }),
          )}
          {boolRow("log-incident", "Incidents geloggt", logging.includeIncident, (v) =>
            setLogging({ ...logging, includeIncident: v }),
          )}
          <div className="col-span-2">
            <Label htmlFor="log-retention" className="text-xs">
              Retention (Tage, min. 180 fuer High-Risk)
            </Label>
            <Input
              id="log-retention"
              type="number"
              min="0"
              value={logging.logRetentionDays}
              onChange={(e) =>
                setLogging({ ...logging, logRetentionDays: parseInt(e.target.value) || 0 })
              }
              className="h-8"
            />
          </div>
        </div>,
      )}

      {/* Section 4: Oversight */}
      {section(
        "Art. 14 Human-Oversight",
        "Design-Check: Override, Stop, verstaendliche Outputs, Bias-Training.",
        Eye,
        oversightResult,
        runOversight,
        <div className="grid md:grid-cols-2 gap-2">
          {boolRow(
            "ov-outputs",
            "Verstaendliche Outputs",
            oversight.hasUnderstandableOutputs,
            (v) => setOversight({ ...oversight, hasUnderstandableOutputs: v }),
          )}
          {boolRow("ov-override", "Override-Capability", oversight.hasOverrideCapability, (v) =>
            setOversight({ ...oversight, hasOverrideCapability: v }),
          )}
          {boolRow("ov-stop", "Stop-Funktion", oversight.hasStopFunction, (v) =>
            setOversight({ ...oversight, hasStopFunction: v }),
          )}
          {boolRow(
            "ov-bias",
            "Automation-Bias-Training",
            oversight.hasAutomationBiasTraining,
            (v) => setOversight({ ...oversight, hasAutomationBiasTraining: v }),
          )}
          {boolRow("ov-roles", "Rollen definiert", oversight.hasDefinedRoles, (v) =>
            setOversight({ ...oversight, hasDefinedRoles: v }),
          )}
          <div className="col-span-2">
            <Label htmlFor="ov-personnel" className="text-xs">
              Qualifiziertes Oversight-Personal (Anzahl)
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
        "Art. 43 + 47 CE-Marking Gate",
        "Aggregierte Pruefung aller Bedingungen fuer CE-Marking.",
        Gavel,
        ceResult,
        runCe,
        <div className="grid md:grid-cols-2 gap-2">
          <div className="col-span-2">
            <Label htmlFor="ce-procedure" className="text-xs">
              Conformity-Procedure
            </Label>
            <select
              id="ce-procedure"
              className="w-full h-8 border rounded px-2 text-sm"
              value={ceGate.procedure}
              onChange={(e) =>
                setCeGate({ ...ceGate, procedure: e.target.value as "annex_vi" | "annex_vii" })
              }
            >
              <option value="annex_vi">Annex VI (Self-Assessment)</option>
              <option value="annex_vii">Annex VII (Notified Body)</option>
            </select>
          </div>
          {boolRow(
            "ce-doc",
            "Declaration-of-Conformity unterzeichnet",
            ceGate.hasSignedDeclarationOfConformity,
            (v) => setCeGate({ ...ceGate, hasSignedDeclarationOfConformity: v }),
          )}
          {boolRow(
            "ce-nb",
            "Notified-Body Certificate vorhanden",
            ceGate.hasNotifiedBodyCertificate,
            (v) => setCeGate({ ...ceGate, hasNotifiedBodyCertificate: v }),
          )}
          {boolRow(
            "ce-eudb",
            "Registriert in EU-Database",
            ceGate.registeredInEuDatabase,
            (v) => setCeGate({ ...ceGate, registeredInEuDatabase: v }),
          )}
          {boolRow(
            "ce-pmm",
            "Post-Market-Monitoring-Plan vorhanden",
            ceGate.hasPostMarketMonitoringPlan,
            (v) => setCeGate({ ...ceGate, hasPostMarketMonitoringPlan: v }),
          )}
          <div className="col-span-2">
            <Label htmlFor="ce-annex" className="text-xs">
              Annex IV Sections komplett (0-9)
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
