"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  RopaEntry,
  RopaDataCategory,
  RopaDataSubject,
  RopaRecipient,
} from "@grc/shared";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-900",
  under_review: "bg-yellow-100 text-yellow-900",
  archived: "bg-gray-50 text-gray-400",
};

export default function RopaDetailPage() {
  return (
    <ModuleGate moduleKey="dpms">
      <RopaDetailInner />
    </ModuleGate>
  );
}

interface RopaDetailData extends RopaEntry {
  categories: RopaDataCategory[];
  subjects: RopaDataSubject[];
  recipients: RopaRecipient[];
  responsibleName?: string;
}

function RopaDetailInner() {
  const t = useTranslations("dpms");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<RopaDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "categories" | "subjects" | "recipients"
  >("overview");
  const [reviewing, setReviewing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/dpms/ropa/${id}`);
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

  const handleReview = async () => {
    setReviewing(true);
    try {
      const res = await fetch(`/api/v1/dpms/ropa/${id}/review`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchData();
      }
    } finally {
      setReviewing(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-center text-gray-500 py-8">{t("ropa.notFound")}</p>
    );
  }

  const tabs = ["overview", "categories", "subjects", "recipients"] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dpms/ropa")}
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className={STATUS_COLORS[data.status] ?? ""}
              >
                {data.status.replace(/_/g, " ")}
              </Badge>
              <span className="text-sm text-gray-500">
                {t("ropa.legalBasisLabel")}:{" "}
                {data.legalBasis.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>
        <Button size="sm" onClick={handleReview} disabled={reviewing}>
          <CheckCircle size={14} className="mr-1" />
          {t("ropa.markReviewed")}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t(`ropa.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">
              {t("ropa.art30Fields")}
            </h2>
            <FieldRow label={t("ropa.purpose")} value={data.purpose} />
            <FieldRow
              label={t("ropa.legalBasisLabel")}
              value={data.legalBasis.replace(/_/g, " ")}
            />
            {data.legalBasisDetail && (
              <FieldRow
                label={t("ropa.legalBasisDetail")}
                value={data.legalBasisDetail}
              />
            )}
            <FieldRow
              label={t("ropa.processingDescription")}
              value={data.processingDescription ?? "-"}
            />
            <FieldRow
              label={t("ropa.processorName")}
              value={data.processorName ?? "-"}
            />
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">
              {t("ropa.retentionAndTransfer")}
            </h2>
            <FieldRow
              label={t("ropa.retentionPeriod")}
              value={data.retentionPeriod ?? "-"}
            />
            <FieldRow
              label={t("ropa.retentionJustification")}
              value={data.retentionJustification ?? "-"}
            />
            <FieldRow
              label={t("ropa.technicalMeasures")}
              value={data.technicalMeasures ?? "-"}
            />
            <FieldRow
              label={t("ropa.organizationalMeasures")}
              value={data.organizationalMeasures ?? "-"}
            />
            <FieldRow
              label={t("ropa.internationalTransfer")}
              value={data.internationalTransfer ? t("ropa.yes") : t("ropa.no")}
            />
            {data.internationalTransfer && (
              <>
                <FieldRow
                  label={t("ropa.transferCountry")}
                  value={data.transferCountry ?? "-"}
                />
                <FieldRow
                  label={t("ropa.transferSafeguard")}
                  value={data.transferSafeguard ?? "-"}
                />
              </>
            )}
            <FieldRow
              label={t("ropa.nextReview")}
              value={data.nextReviewDate ?? "-"}
            />
            <FieldRow
              label={t("ropa.lastReviewed")}
              value={
                data.lastReviewed
                  ? new Date(data.lastReviewed).toLocaleDateString()
                  : "-"
              }
            />
          </div>
        </div>
      )}

      {activeTab === "categories" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            {t("ropa.dataCategories")}
          </h2>
          {data.categories.length === 0 ? (
            <p className="text-sm text-gray-400">{t("ropa.noCategories")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.categories.map((cat) => (
                <Badge key={cat.id} variant="outline">
                  {cat.category}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "subjects" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            {t("ropa.dataSubjects")}
          </h2>
          {data.subjects.length === 0 ? (
            <p className="text-sm text-gray-400">{t("ropa.noSubjects")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.subjects.map((sub) => (
                <Badge key={sub.id} variant="outline">
                  {sub.subjectCategory}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "recipients" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            {t("ropa.recipients")}
          </h2>
          {data.recipients.length === 0 ? (
            <p className="text-sm text-gray-400">{t("ropa.noRecipients")}</p>
          ) : (
            <div className="space-y-2">
              {data.recipients.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between border-b border-gray-100 pb-2"
                >
                  <span className="text-sm text-gray-900">
                    {rec.recipientName}
                  </span>
                  {rec.recipientType && (
                    <Badge variant="outline" className="text-xs">
                      {rec.recipientType}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5">{value}</dd>
    </div>
  );
}
