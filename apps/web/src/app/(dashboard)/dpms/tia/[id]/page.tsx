"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Globe,
  Scale,
  FileText,
  Calendar,
  User,
  ShieldAlert,
} from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDateFormat } from "@/lib/format-date";

/* ── Types ── */

interface TiaDetail {
  id: string;
  title: string;
  transferCountry: string;
  legalBasis: string;
  schremsIiAssessment: string | null;
  riskRating: string;
  supportingDocuments: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  assessmentDate: string | null;
  nextReviewDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ── Label Maps ── */

const RISK_KEYS = ["low", "medium", "high"];
const LEGAL_BASIS_KEYS = ["adequacy", "sccs", "bcrs", "derogation"];

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-900",
  medium: "bg-yellow-100 text-yellow-900",
  high: "bg-red-100 text-red-900",
};

/* ── Helpers ── */

function isReviewDue(nextReview: string | null): boolean {
  if (!nextReview) return false;
  return new Date(nextReview) < new Date();
}

/* ── Component ── */

export default function TiaDetailPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <TiaDetailInner />
    </ModuleGate>
  );
}

function TiaDetailInner() {
  const { formatDate: fmtDate } = useDateFormat();
  const t = useTranslations("dpms");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher `null` (die Seite zeigt dann „nicht gefunden").
  const { data = null, isPending: loading } = useQuery<TiaDetail | null>({
    queryKey: ["dpms", "tia", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/dpms/tia/${id}`);
      if (!res.ok) return null;
      const json = await res.json();
      return (json.data ?? null) as TiaDetail | null;
    },
  });

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-center text-gray-500 py-12">
        {t("tia.detail.notFound")}
      </p>
    );
  }

  const reviewDue = isReviewDue(data.nextReviewDate);
  const riskLabel = RISK_KEYS.includes(data.riskRating)
    ? t(`tia.riskRating.${data.riskRating}`)
    : data.riskRating;
  const legalBasisLabel = LEGAL_BASIS_KEYS.includes(data.legalBasis)
    ? t(`tia.legalBasisValues.${data.legalBasis}`)
    : data.legalBasis;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dpms/tia")}
            aria-label={t("tia.detail.back")}
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={RISK_COLORS[data.riskRating] ?? "bg-gray-100"}>
                {riskLabel}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Globe size={10} className="mr-1" />
                {data.transferCountry}
              </Badge>
              {reviewDue && (
                <Badge className="bg-red-600 text-white text-xs">
                  <Calendar size={10} className="mr-1" />{" "}
                  {t("tia.detail.reviewOverdueBadge")}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transferdetails */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Globe size={14} /> {t("tia.detail.transferDetails")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FieldRow
            label={t("tia.detail.targetCountry")}
            value={data.transferCountry}
          />
          <FieldRow label={t("tia.legalBasis")} value={legalBasisLabel} />
          <FieldRow
            label={t("tia.riskRatingLabel")}
            value={riskLabel}
            badge={data.riskRating}
            badgeColors={RISK_COLORS}
          />
        </div>
      </div>

      {/* Schrems II Assessment */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Scale size={14} /> {t("tia.detail.schremsIi")}
        </h2>
        {data.schremsIiAssessment ? (
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {data.schremsIiAssessment}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {t("tia.detail.schremsIiEmpty")}
          </p>
        )}
      </div>

      {/* Risikobewertung */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 flex items-center gap-2">
          <ShieldAlert size={14} /> {t("tia.detail.riskAndSafeguards")}
        </h2>
        <div className="space-y-4">
          <div
            className={`rounded-lg p-4 ${
              data.riskRating === "high"
                ? "bg-red-50 border border-red-200"
                : data.riskRating === "medium"
                  ? "bg-yellow-50 border border-yellow-200"
                  : "bg-green-50 border border-green-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldAlert
                size={16}
                className={
                  data.riskRating === "high"
                    ? "text-red-600"
                    : data.riskRating === "medium"
                      ? "text-yellow-600"
                      : "text-green-600"
                }
              />
              <span className="font-medium text-sm">
                {t("tia.detail.riskClassification", { rating: riskLabel })}
              </span>
            </div>
            {data.riskRating === "high" && (
              <p className="text-sm mt-2 text-red-700">
                {t("tia.detail.riskHigh")}
              </p>
            )}
            {data.riskRating === "medium" && (
              <p className="text-sm mt-2 text-yellow-700">
                {t("tia.detail.riskMedium")}
              </p>
            )}
            {data.riskRating === "low" && (
              <p className="text-sm mt-2 text-green-700">
                {t("tia.detail.riskLow")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Dokumente */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 flex items-center gap-2">
          <FileText size={14} /> {t("tia.detail.documents")}
        </h2>
        {data.supportingDocuments ? (
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {data.supportingDocuments}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {t("tia.detail.documentsEmpty")}
          </p>
        )}
      </div>

      {/* Verantwortung & Termine */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 flex items-center gap-2">
          <User size={14} /> {t("tia.detail.responsibility")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FieldRow
            label={t("tia.detail.responsible")}
            value={data.responsibleName ?? "—"}
          />
          <FieldRow
            label={t("tia.detail.assessmentDate")}
            value={fmtDate(data.assessmentDate)}
          />
          <FieldRow
            label={t("tia.detail.nextReview")}
            value={fmtDate(data.nextReviewDate)}
            highlight={reviewDue}
          />
          <FieldRow
            label={t("tia.detail.createdAt")}
            value={fmtDate(data.createdAt)}
          />
        </div>
      </div>

      {/* Review Warning */}
      {reviewDue && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-red-700">
            <Calendar size={14} />
            {t("tia.detail.reviewOverdue")}
          </div>
          <p className="text-sm text-red-600 mt-1">
            {t("tia.detail.reviewOverdueHint", {
              date: fmtDate(data.nextReviewDate),
            })}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Field Row ── */

function FieldRow({
  label,
  value,
  highlight,
  badge,
  badgeColors,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  badge?: string;
  badgeColors?: Record<string, string>;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd
        className={`text-sm mt-0.5 ${highlight ? "text-red-600 font-semibold" : "text-gray-900"}`}
      >
        {badge && badgeColors ? (
          <Badge className={`${badgeColors[badge] ?? "bg-gray-100"} text-xs`}>
            {value}
          </Badge>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
