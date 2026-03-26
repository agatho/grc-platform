"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";

interface CompletionData {
  vendorName: string;
  templateName: string;
  submittedAt: string;
  totalQuestions: number;
  answeredQuestions: number;
  evidenceCount: number;
  contactEmail: string;
  orgName: string;
  sections: number;
}

export default function DdCompletePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<CompletionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/portal/dd/${token}`);
        if (res.ok) {
          const json = await res.json();
          setData({
            vendorName: json.data?.supplierName ?? "Supplier",
            templateName: json.data?.templateName ?? "Questionnaire",
            submittedAt: json.data?.submittedAt ?? new Date().toISOString(),
            totalQuestions: json.data?.totalQuestions ?? 0,
            answeredQuestions: json.data?.answeredQuestions ?? 0,
            evidenceCount: json.data?.evidenceCount ?? 0,
            contactEmail: json.data?.contactEmail ?? "",
            orgName: json.data?.orgName ?? "",
            sections: json.data?.sectionCount ?? 0,
          });
        }
      } catch {
        // Show default completion page
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Success icon */}
      <div className="rounded-full bg-green-50 p-4 mb-6">
        <CheckCircle2 size={48} className="text-green-500" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Questionnaire Submitted
      </h1>

      <p className="text-gray-600 mb-8 max-w-md">
        Your questionnaire has been submitted successfully. Thank you for your
        time and cooperation.
      </p>

      {/* Summary card */}
      {data && (
        <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 mb-6 text-left">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Submission Summary
          </h3>
          <dl className="space-y-3">
            <SummaryRow label="Questionnaire" value={data.templateName} />
            <SummaryRow label="Vendor" value={data.vendorName} />
            <SummaryRow
              label="Submitted"
              value={new Date(data.submittedAt).toLocaleString()}
            />
            <SummaryRow
              label="Questions Answered"
              value={`${data.answeredQuestions} / ${data.totalQuestions}`}
            />
            <SummaryRow label="Sections" value={String(data.sections)} />
            <SummaryRow
              label="Evidence Files"
              value={String(data.evidenceCount)}
            />
          </dl>
        </div>
      )}

      {/* Download button */}
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors mb-8"
        onClick={() => {
          // PDF download would be triggered here
          window.open(`/api/v1/portal/dd/${token}/pdf`, "_blank");
        }}
      >
        <Download size={16} />
        Download PDF Summary
      </button>

      {/* Contact info */}
      {data?.contactEmail && (
        <p className="text-sm text-gray-500 max-w-md">
          You may close this window. For questions, contact{" "}
          <a
            href={`mailto:${data.contactEmail}`}
            className="text-blue-600 hover:underline"
          >
            {data.contactEmail}
          </a>
          .
        </p>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}
