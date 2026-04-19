"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Calendar,
  Printer,
  Brain,
  FileCheck,
  FileWarning,
  ShieldCheck,
  Settings2,
  Cpu,
  Sparkles,
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

interface SectionHealth {
  healthScore: number;
  narrative: string;
}

interface RawInput {
  systems: {
    total: number;
    byRisk: {
      unacceptable: number;
      high: number;
      limited: number;
      minimal: number;
    };
    compliant: number;
    nonCompliant: number;
    inAssessment: number;
  };
  conformityAssessments: {
    completed: number;
    passed: number;
    failed: number;
    pending: number;
  };
  incidents: {
    totalReported: number;
    seriousIncidents: number;
    overdueNotifications: number;
    averageTimeToNotifyHours: number | null;
  };
  fria: { required: number; completed: number; approved: number };
  qms: { avgMaturity: number; readyForCe: number; notReadyForCe: number };
  gpai: { total: number; systemic: number };
  correctiveActions: { open: number; closed: number; overdue: number };
}

interface AnnualReportResponse {
  year: number;
  overallComplianceScore: number;
  criticalFindings: string[];
  highlights: string[];
  readyForSubmission: boolean;
  sections: {
    systems: SectionHealth;
    conformity: SectionHealth;
    incidents: SectionHealth;
    fria: SectionHealth;
    qms: SectionHealth;
    gpai: SectionHealth;
  };
  rawInput: RawInput;
  organization: { id: string; name: string };
}

const SECTION_META = [
  {
    key: "systems" as const,
    label: "AI Systems",
    icon: Brain,
    description: "Portfolio + Risk-Klassifikation + Compliance-Status.",
  },
  {
    key: "conformity" as const,
    label: "Conformity Assessments",
    icon: FileCheck,
    description: "Art. 43 Assessments + Pass/Fail-Rate.",
  },
  {
    key: "incidents" as const,
    label: "Post-Market Incidents",
    icon: FileWarning,
    description: "Art. 73 Incidents + Art. 33 Notification-Timings.",
  },
  {
    key: "fria" as const,
    label: "FRIA",
    icon: ShieldCheck,
    description: "Art. 27 Fundamental-Rights-Impact-Assessments.",
  },
  {
    key: "qms" as const,
    label: "Quality Management System",
    icon: Settings2,
    description: "Art. 17 QMS Maturity + CE-Readiness.",
  },
  {
    key: "gpai" as const,
    label: "GPAI Models",
    icon: Cpu,
    description: "Art. 51-55 GPAI + Systemic-Risk-Designation.",
  },
];

function scoreStatus(score: number): "green" | "amber" | "red" {
  if (score >= 80) return "green";
  if (score >= 60) return "amber";
  return "red";
}

function scorePill(score: number) {
  const status = scoreStatus(score);
  const className =
    status === "green"
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : status === "amber"
        ? "bg-amber-100 text-amber-800 border-amber-300"
        : "bg-red-100 text-red-800 border-red-300";
  return (
    <Badge variant="outline" className={className}>
      {score}/100
    </Badge>
  );
}

function scoreBar(score: number) {
  const status = scoreStatus(score);
  const color =
    status === "green" ? "bg-emerald-500" : status === "amber" ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div className={`${color} h-full transition-all`} style={{ width: `${score}%` }} />
    </div>
  );
}

export default function AiActAnnualReportPage() {
  const router = useRouter();
  const { year: yearParam } = useParams<{ year: string }>();
  const year = parseInt(yearParam, 10) || new Date().getUTCFullYear();
  const [data, setData] = useState<AnnualReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/ai-act/annual-report/${year}`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium">Annual Report konnte nicht geladen werden</p>
            </div>
            <p className="text-sm text-red-700 mt-2">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const overallStatus = scoreStatus(data.overallComplianceScore);
  const availableYears = Array.from({ length: 5 }, (_, i) => new Date().getUTCFullYear() - 2 + i);

  return (
    <div className="space-y-6 p-6 print:p-0">
      {/* Header */}
      <div className="flex items-start justify-between print:block">
        <div>
          <Link
            href="/ai-act"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2 print:hidden"
          >
            <ArrowLeft className="h-3 w-3" />
            Zurueck zur AI-Act-Uebersicht
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">AI-Act Annual Report {year}</h1>
          <p className="text-muted-foreground mt-1">{data.organization.name}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <select
            value={year}
            onChange={(e) => router.push(`/ai-act/annual-report/${e.target.value}`)}
            className="h-9 px-3 border rounded-md text-sm"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Drucken / PDF
          </Button>
        </div>
      </div>

      {/* Headline score */}
      <Card
        className={
          overallStatus === "red"
            ? "border-red-300 bg-red-50/30 dark:bg-red-950/10"
            : overallStatus === "amber"
              ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10"
              : "border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/10"
        }
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Overall Compliance Score</CardTitle>
              <CardDescription>
                Gewichteter Composite: Systems 25% / Conformity 20% / Incidents 15% /
                FRIA 15% / QMS 15% / GPAI 10%.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {data.readyForSubmission ? (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Einreichbar
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Nicht einreichbar
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold">{data.overallComplianceScore}</span>
            <span className="text-muted-foreground">/ 100</span>
          </div>
          <Progress value={data.overallComplianceScore} className="h-3" />
        </CardContent>
      </Card>

      {/* Critical + highlights */}
      <div className="grid md:grid-cols-2 gap-4">
        {data.criticalFindings.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Kritische Befunde ({data.criticalFindings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.criticalFindings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-red-600 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {data.highlights.length > 0 && (
          <Card className="border-emerald-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                Highlights ({data.highlights.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-600 flex-shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Section grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {SECTION_META.map((meta) => {
          const section = data.sections[meta.key];
          const Icon = meta.icon;
          return (
            <Card key={meta.key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">{meta.label}</CardTitle>
                      <CardDescription className="text-xs">
                        {meta.description}
                      </CardDescription>
                    </div>
                  </div>
                  {scorePill(section.healthScore)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {scoreBar(section.healthScore)}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {section.narrative}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Raw input drill-down */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Zahlen-Drill-Down</CardTitle>
          </div>
          <CardDescription>
            Rohdaten aus den Aggregations-Queries fuer Auditor-Nachvollziehbarkeit.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <p className="font-medium mb-1">Systems</p>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span>{data.rawInput.systems.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">High-Risk</span>
                <span>{data.rawInput.systems.byRisk.high}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>Unacceptable</span>
                <span>{data.rawInput.systems.byRisk.unacceptable}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Compliant</span>
                <span>{data.rawInput.systems.compliant}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Non-Compliant</span>
                <span>{data.rawInput.systems.nonCompliant}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="font-medium mb-1">Conformity</p>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span>{data.rawInput.conformityAssessments.completed}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Passed</span>
                <span>{data.rawInput.conformityAssessments.passed}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>Failed</span>
                <span>{data.rawInput.conformityAssessments.failed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending</span>
                <span>{data.rawInput.conformityAssessments.pending}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="font-medium mb-1">Incidents</p>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gemeldet</span>
                <span>{data.rawInput.incidents.totalReported}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Serious</span>
                <span>{data.rawInput.incidents.seriousIncidents}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>Ueberfaellig (Art. 73)</span>
                <span>{data.rawInput.incidents.overdueNotifications}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg. Notify (h)</span>
                <span>{data.rawInput.incidents.averageTimeToNotifyHours ?? "—"}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="font-medium mb-1">FRIA</p>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Erforderlich</span>
                <span>{data.rawInput.fria.required}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span>{data.rawInput.fria.completed}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Approved</span>
                <span>{data.rawInput.fria.approved}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="font-medium mb-1">QMS</p>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg. Maturity</span>
                <span>{data.rawInput.qms.avgMaturity}%</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>CE-ready</span>
                <span>{data.rawInput.qms.readyForCe}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Nicht CE-ready</span>
                <span>{data.rawInput.qms.notReadyForCe}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="font-medium mb-1">GPAI</p>
            <div className="space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gesamt</span>
                <span>{data.rawInput.gpai.total}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Systemic</span>
                <span>{data.rawInput.gpai.systemic}</span>
              </div>
            </div>
          </div>
          <div className="col-span-3">
            <p className="font-medium mb-1">Corrective Actions</p>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Offen</span>
                <span>{data.rawInput.correctiveActions.open}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Geschlossen</span>
                <span>{data.rawInput.correctiveActions.closed}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>Ueberfaellig</span>
                <span>{data.rawInput.correctiveActions.overdue}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
