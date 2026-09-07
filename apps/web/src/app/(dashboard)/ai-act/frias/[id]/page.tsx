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
import { useTranslations } from "next-intl";
import { useDateFormat } from "@/lib/format-date";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Welle 6b. Diese Seite war zur Haelfte
 * englisch und zur Haelfte deutsch, oft im selben Satz ("Ein vollstaendiger
 * FRIA sollte mindestens 5 der 10 Core Rights adressieren"). Beide
 * Sprachgruppen lasen also Mischtext.
 *
 * Zwei Nebenbefunde, die dabei mitgehen:
 *   • `nextReviewDate` wurde als ROHE ISO-Zeichenkette gerendert
 *     ("2026-11-30"), obwohl `lib/format-date.ts` seit FE-HIGH-2 genau
 *     dafuer da ist — dieselbe Form wie OP-190 aus Welle 5a.
 *   • `quality.missing` kommt als Liste englischer Bezeichner AUS DER API
 *     (`app/api/v1/ai-act/frias/[id]/quality-check`) und wird unveraendert
 *     angezeigt — auch im deutschen Gebietsschema. Die Route liegt ausserhalb
 *     der Dateihoheit dieser Welle, der Befund ist deshalb beziffert und
 *     nicht behoben: die Liste bleibt englisch, alles darum herum nicht.
 */
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

const IMPACT_PILL: Record<RightImpact, string> = {
  high: "bg-red-100 text-red-800 border-red-300",
  medium: "bg-amber-100 text-amber-800 border-amber-300",
  low: "bg-sky-100 text-sky-800 border-sky-300",
  negligible: "bg-slate-100 text-slate-700 border-slate-300",
};

export default function FriaDetailPage() {
  const t = useTranslations("aiAct");
  const tCommon = useTranslations("common");
  const { formatDate } = useDateFormat();
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
      if (!res.ok)
        throw new Error(tCommon("common.httpError", { status: res.status }));
      const json = await res.json();
      const data = json.data ?? json;
      setFria({
        id: data.id,
        assessmentCode: data.assessmentCode,
        aiSystemId: data.aiSystemId,
        overallImpact: data.overallImpact,
        status: data.status,
        rightsAssessed: Array.isArray(data.rightsAssessed)
          ? data.rightsAssessed
          : [],
        mitigationMeasures: data.mitigationMeasures ?? null,
        nextReviewDate: data.nextReviewDate ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : tCommon("common.error"));
    } finally {
      setLoading(false);
    }
  }, [id, tCommon]);

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
      setError(e instanceof Error ? e.message : tCommon("common.error"));
    } finally {
      setRunningQuality(false);
    }
  }, [id, quality_flags, tCommon]);

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
    <div
      className="flex items-start justify-between py-2 border-b last:border-0"
      key={key}
    >
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
              <p className="font-medium">{t("fria.loadError")}</p>
            </div>
            <p className="text-sm text-red-700 mt-2">
              {error ?? t("fria.notFound")}
            </p>
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
            {t("fria.backToList")}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {fria.assessmentCode}
            </h1>
            <Badge
              variant="outline"
              className={IMPACT_PILL[fria.overallImpact]}
            >
              {t("fria.overallImpact", {
                value: t(`fria.impact.${fria.overallImpact}`),
              })}
            </Badge>
            <Badge variant="outline">{fria.status}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("fria.subtitle")}{" "}
            <Link
              href={`/ai-act/systems/${fria.aiSystemId}`}
              className="text-primary hover:underline"
            >
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
          {t("fria.qualityCheck")}
        </Button>
      </div>

      {/* Rights assessed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t("fria.rightsTitle", { count: fria.rightsAssessed.length })}
          </CardTitle>
          <CardDescription>{t("fria.rightsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {fria.rightsAssessed.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("fria.rightsEmpty")}
            </p>
          ) : (
            <div className="space-y-3">
              {fria.rightsAssessed.map((r, i) => (
                <div key={i} className="border rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-sm">
                      {t(`fria.right.${r.right}`)}
                    </p>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className={`text-xs ${IMPACT_PILL[r.impact]}`}
                      >
                        {t("fria.impactPill", {
                          value: t(`fria.impact.${r.impact}`),
                        })}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${IMPACT_PILL[r.residualRisk]}`}
                      >
                        {t("fria.residualPill", {
                          value: t(`fria.impact.${r.residualRisk}`),
                        })}
                      </Badge>
                    </div>
                  </div>
                  {r.mitigation && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium">
                        {t("fria.mitigation")}
                      </span>{" "}
                      {r.mitigation}
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
            {t("fria.flagsTitle")}
          </CardTitle>
          <CardDescription>{t("fria.flagsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          {boolRow(
            "q-disc",
            t("fria.flag.discrimination"),
            t("fria.flag.discriminationHint"),
            quality_flags.hasDiscriminationAnalysis,
            (v) =>
              setQualityFlags({
                ...quality_flags,
                hasDiscriminationAnalysis: v,
              }),
          )}
          {boolRow(
            "q-dpi",
            t("fria.flag.dataProtection"),
            t("fria.flag.dataProtectionHint"),
            quality_flags.hasDataProtectionImpact,
            (v) =>
              setQualityFlags({ ...quality_flags, hasDataProtectionImpact: v }),
          )}
          {boolRow(
            "q-atj",
            t("fria.flag.accessToJustice"),
            t("fria.flag.accessToJusticeHint"),
            quality_flags.hasAccessToJusticeAnalysis,
            (v) =>
              setQualityFlags({
                ...quality_flags,
                hasAccessToJusticeAnalysis: v,
              }),
          )}
          {boolRow(
            "q-cons",
            t("fria.flag.consultation"),
            t("fria.flag.consultationHint"),
            quality_flags.hasAffectedPersonsConsultation,
            (v) =>
              setQualityFlags({
                ...quality_flags,
                hasAffectedPersonsConsultation: v,
              }),
          )}
          {boolRow(
            "q-oi",
            t("fria.flag.overallImpactStatement"),
            t("fria.flag.overallImpactStatementHint"),
            quality_flags.hasOverallImpactStatement,
            (v) =>
              setQualityFlags({
                ...quality_flags,
                hasOverallImpactStatement: v,
              }),
          )}
          {boolRow(
            "q-mit",
            t("fria.flag.mitigationDocumented"),
            t("fria.flag.mitigationDocumentedHint"),
            quality_flags.hasMitigationMeasuresDocumented,
            (v) =>
              setQualityFlags({
                ...quality_flags,
                hasMitigationMeasuresDocumented: v,
              }),
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
                {t("fria.resultTitle")}
              </CardTitle>
              {quality.isApprovable ? (
                <Badge
                  variant="outline"
                  className="bg-emerald-100 text-emerald-800 border-emerald-300"
                >
                  {t("fria.approvable")}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-amber-100 text-amber-800 border-amber-300"
                >
                  {t("fria.notApprovable")}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>{t("fria.rightsCoverage")}</span>
                  <span className="font-medium">{quality.rightsCoverage}%</span>
                </div>
                <Progress value={quality.rightsCoverage} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>{t("fria.qualityChecks")}</span>
                  <span className="font-medium">
                    {quality.qualityChecksPercent}%
                  </span>
                </div>
                <Progress
                  value={quality.qualityChecksPercent}
                  className="h-2"
                />
              </div>
            </div>

            {quality.hasHighResidualRisk && (
              <div className="border border-red-300 bg-red-50 dark:bg-red-950/20 rounded p-3">
                <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t("fria.highResidualTitle")}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {quality.highResidualRights.map((r, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="bg-red-100 text-red-800 border-red-300 text-xs"
                    >
                      {t(`fria.right.${r}`)}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-red-700 mt-2">
                  {t("fria.highResidualHint")}
                </p>
              </div>
            )}

            {quality.missing.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {t("fria.missingChecks")}
                </p>
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
                {t("fria.approvalRequirements")}
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
              <p className="text-xs text-muted-foreground mb-1">
                {t("fria.nextReview")}
              </p>
              <p className="flex items-center gap-1 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {fria.nextReviewDate ? formatDate(fria.nextReviewDate) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {t("fria.aiSystem")}
              </p>
              <Link
                href={`/ai-act/systems/${fria.aiSystemId}`}
                className="text-sm text-primary hover:underline"
              >
                {fria.aiSystemId.slice(0, 8)}...
              </Link>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {t("shared.status")}
              </p>
              <Badge variant="outline">{fria.status}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
