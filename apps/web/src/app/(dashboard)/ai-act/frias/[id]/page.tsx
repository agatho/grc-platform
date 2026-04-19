"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ClipboardCheck,
  UserCheck,
  Calendar,
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

type FundamentalRight =
  | "dignity"
  | "equality_non_discrimination"
  | "privacy_data_protection"
  | "freedom_expression"
  | "freedom_assembly"
  | "freedom_movement"
  | "access_to_justice"
  | "workers_rights"
  | "consumer_protection"
  | "child_protection";

type RightImpact = "high" | "medium" | "low" | "negligible";

interface FriaRight {
  right: FundamentalRight;
  impact: RightImpact;
  mitigation: string;
  residualRisk: RightImpact;
}

interface FriaDetail {
  id: string;
  assessmentCode: string;
  aiSystemId: string;
  overallImpact: "high" | "medium" | "low" | "negligible";
  status: string;
  rightsAssessed: FriaRight[];
  mitigationMeasures: string | null;
  nextReviewDate: string | null;
}

interface QualityResult {
  rightsCoverage: number;
  qualityChecksPercent: number;
  hasHighResidualRisk: boolean;
  highResidualRights: FundamentalRight[];
  missing: string[];
  isApprovable: boolean;
}

const RIGHT_LABEL: Record<FundamentalRight, string> = {
  dignity: "Dignity",
  equality_non_discrimination: "Equality / Non-Discrimination",
  privacy_data_protection: "Privacy / Data Protection",
  freedom_expression: "Freedom of Expression",
  freedom_assembly: "Freedom of Assembly",
  freedom_movement: "Freedom of Movement",
  access_to_justice: "Access to Justice",
  workers_rights: "Workers' Rights",
  consumer_protection: "Consumer Protection",
  child_protection: "Child Protection",
};

const IMPACT_PILL: Record<RightImpact, string> = {
  high: "bg-red-100 text-red-800 border-red-300",
  medium: "bg-amber-100 text-amber-800 border-amber-300",
  low: "bg-sky-100 text-sky-800 border-sky-300",
  negligible: "bg-slate-100 text-slate-700 border-slate-300",
};

export default function FriaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [fria, setFria] = useState<FriaDetail | null>(null);
  const [quality, setQuality] = useState<QualityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningQuality, setRunningQuality] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quality_flags, setQualityFlags] = useState({
    hasDiscriminationAnalysis: false,
    hasDataProtectionImpact: false,
    hasAccessToJusticeAnalysis: false,
    hasAffectedPersonsConsultation: false,
    hasOverallImpactStatement: false,
    hasMitigationMeasuresDocumented: false,
  });

  const fetchFria = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/ai-act/frias/${id}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      const data = json.data ?? json;
      setFria({
        id: data.id,
        assessmentCode: data.assessmentCode,
        aiSystemId: data.aiSystemId,
        overallImpact: data.overallImpact,
        status: data.status,
        rightsAssessed: Array.isArray(data.rightsAssessed) ? data.rightsAssessed : [],
        mitigationMeasures: data.mitigationMeasures ?? null,
        nextReviewDate: data.nextReviewDate ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const runQualityCheck = useCallback(async () => {
    setRunningQuality(true);
    try {
      const res = await fetch(`/api/v1/ai-act/frias/${id}/quality-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quality_flags),
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const json = await res.json();
      setQuality(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setRunningQuality(false);
    }
  }, [id, quality_flags]);

  useEffect(() => {
    void fetchFria();
  }, [fetchFria]);

  const boolRow = (
    key: string,
    label: string,
    description: string,
    value: boolean,
    onChange: (v: boolean) => void,
  ) => (
    <div className="flex items-start justify-between py-2 border-b last:border-0" key={key}>
      <div className="flex-1 pr-4">
        <Label htmlFor={key} className="text-sm cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch id={key} checked={value} onCheckedChange={onChange} />
    </div>
  );

  if (loading && !fria) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !fria) {
    return (
      <div className="p-6">
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium">FRIA konnte nicht geladen werden</p>
            </div>
            <p className="text-sm text-red-700 mt-2">{error ?? "Not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/ai-act/frias"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            Zurueck zur FRIA-Liste
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{fria.assessmentCode}</h1>
            <Badge variant="outline" className={IMPACT_PILL[fria.overallImpact]}>
              Overall: {fria.overallImpact}
            </Badge>
            <Badge variant="outline">{fria.status}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Art. 27 Fundamental-Rights-Impact-Assessment — verlinkt mit AI-System{" "}
            <Link href={`/ai-act/systems/${fria.aiSystemId}`} className="text-primary hover:underline">
              {fria.aiSystemId.slice(0, 8)}...
            </Link>
          </p>
        </div>
        <Button onClick={runQualityCheck} disabled={runningQuality}>
          {runningQuality ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ClipboardCheck className="h-4 w-4 mr-2" />
          )}
          Quality Check
        </Button>
      </div>

      {/* Rights assessed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Assessed Fundamental Rights ({fria.rightsAssessed.length})
          </CardTitle>
          <CardDescription>
            Ein vollstaendiger FRIA sollte mindestens 5 der 10 Core Rights adressieren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fria.rightsAssessed.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Noch keine Rights erfasst. Rights-Assessments werden ueber das FRIA-Formular
              eingepflegt (Detail-Edit).
            </p>
          ) : (
            <div className="space-y-3">
              {fria.rightsAssessed.map((r, i) => (
                <div key={i} className="border rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm">{RIGHT_LABEL[r.right] ?? r.right}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={`text-xs ${IMPACT_PILL[r.impact]}`}>
                        Impact: {r.impact}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${IMPACT_PILL[r.residualRisk]}`}
                      >
                        Residual: {r.residualRisk}
                      </Badge>
                    </div>
                  </div>
                  {r.mitigation && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium">Mitigation:</span> {r.mitigation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quality Check Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="h-5 w-5 text-primary" />
            Quality Flags
          </CardTitle>
          <CardDescription>
            Assessor bestaetigt welche Teilbereiche dokumentiert und geprueft wurden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          {boolRow(
            "q-disc",
            "Discrimination-Analyse",
            "Bias + Ungleichbehandlung systematisch bewertet.",
            quality_flags.hasDiscriminationAnalysis,
            (v) => setQualityFlags({ ...quality_flags, hasDiscriminationAnalysis: v }),
          )}
          {boolRow(
            "q-dpi",
            "Data-Protection-Impact",
            "Datenschutz-Folgen separat dokumentiert (ggf. DPIA-Verknuepfung).",
            quality_flags.hasDataProtectionImpact,
            (v) => setQualityFlags({ ...quality_flags, hasDataProtectionImpact: v }),
          )}
          {boolRow(
            "q-atj",
            "Access-to-Justice-Analyse",
            "Rechtsschutz, Beschwerden, Widerrufsmoeglichkeiten geprueft.",
            quality_flags.hasAccessToJusticeAnalysis,
            (v) => setQualityFlags({ ...quality_flags, hasAccessToJusticeAnalysis: v }),
          )}
          {boolRow(
            "q-cons",
            "Betroffenen-Konsultation",
            "Affected persons oder deren Vertreter in den Prozess einbezogen.",
            quality_flags.hasAffectedPersonsConsultation,
            (v) => setQualityFlags({ ...quality_flags, hasAffectedPersonsConsultation: v }),
          )}
          {boolRow(
            "q-oi",
            "Overall-Impact-Statement",
            "Abschliessende Bewertung liegt vor.",
            quality_flags.hasOverallImpactStatement,
            (v) => setQualityFlags({ ...quality_flags, hasOverallImpactStatement: v }),
          )}
          {boolRow(
            "q-mit",
            "Mitigation-Measures dokumentiert",
            "Konkrete Massnahmen fuer jedes identifizierte Risiko.",
            quality_flags.hasMitigationMeasuresDocumented,
            (v) => setQualityFlags({ ...quality_flags, hasMitigationMeasuresDocumented: v }),
          )}
        </CardContent>
      </Card>

      {/* Quality Result */}
      {quality && (
        <Card
          className={
            quality.isApprovable
              ? "border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/10"
              : "border-amber-300 bg-amber-50/30 dark:bg-amber-950/10"
          }
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {quality.isApprovable ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
                Quality-Check Ergebnis
              </CardTitle>
              {quality.isApprovable ? (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                  Approvable
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                  Nicht approvable
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Rights Coverage (10 core)</span>
                  <span className="font-medium">{quality.rightsCoverage}%</span>
                </div>
                <Progress value={quality.rightsCoverage} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Quality-Checks (6)</span>
                  <span className="font-medium">{quality.qualityChecksPercent}%</span>
                </div>
                <Progress value={quality.qualityChecksPercent} className="h-2" />
              </div>
            </div>

            {quality.hasHighResidualRisk && (
              <div className="border border-red-300 bg-red-50 dark:bg-red-950/20 rounded p-3">
                <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  High-Residual-Risk auf folgenden Rights:
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {quality.highResidualRights.map((r, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="bg-red-100 text-red-800 border-red-300 text-xs"
                    >
                      {RIGHT_LABEL[r] ?? r}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-red-700 mt-2">
                  Blockt die Approval. Mitigation-Massnahmen verstaerken oder System nicht
                  einsetzen.
                </p>
              </div>
            )}

            {quality.missing.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Fehlende Quality-Checks:</p>
                <div className="flex flex-wrap gap-1">
                  {quality.missing.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {!quality.isApprovable && !quality.hasHighResidualRisk && (
              <p className="text-sm text-muted-foreground">
                Zum Approval noetig: &ge; 5 Rights erfasst, alle 6 Quality-Checks erfuellt,
                keine High-Residual-Risks.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Metadata footer */}
      <Card>
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Naechste Review</p>
              <p className="flex items-center gap-1 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {fria.nextReviewDate ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">AI-System</p>
              <Link
                href={`/ai-act/systems/${fria.aiSystemId}`}
                className="text-sm text-primary hover:underline"
              >
                {fria.aiSystemId.slice(0, 8)}...
              </Link>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Badge variant="outline">{fria.status}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
