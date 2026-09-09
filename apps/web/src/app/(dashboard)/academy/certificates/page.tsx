"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCcw, Award, Download } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { useDateFormat } from "@/lib/format-date";

interface Certificate {
  id: string;
  certificateNumber: string;
  courseId: string;
  pdfUrl: string | null;
  issuedAt: string;
  expiresAt: string | null;
}

export default function CertificatesPage() {
  return (
    <ModuleGate moduleKey="academy">
      <CertificatesList />
    </ModuleGate>
  );
}

function CertificatesList() {
  const t = useTranslations("academy");
  const { formatDate } = useDateFormat();
  // [OP-245 · Gestalt A] Abruf beim Einhängen über `@tanstack/react-query`
  // statt Effekt plus gespiegeltem Lade- und Datenzustand (Muster aus
  // Welle 7b, `catalogs/objects/page.tsx`). Eine nicht-ok-Antwort liefert wie
  // vorher eine leere Liste; ein Netzfehler wird nicht mehr verschluckt,
  // sondern landet im Fehlerzustand der Abfrage.
  const {
    data: items = [],
    isPending: loading,
    isFetching,
    refetch,
  } = useQuery<Certificate[]>({
    queryKey: ["academy", "certificates"],
    queryFn: async () => {
      const res = await fetch("/api/v1/academy/certificates");
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as Certificate[];
    },
  });

  const fetchData = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("certificates.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("certificates.description")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={isFetching}
        >
          <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} />
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {t("certificates.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((cert) => (
            <div
              key={cert.id}
              className="rounded-lg border border-gray-200 bg-white p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Award size={18} className="text-yellow-500" />
                <span className="text-sm font-semibold text-gray-900">
                  {cert.certificateNumber}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {t("certificates.issuedAt")}: {formatDate(cert.issuedAt)}
              </p>
              {cert.expiresAt && (
                <p className="text-xs text-gray-500">
                  {t("certificates.expiresAt")}: {formatDate(cert.expiresAt)}
                </p>
              )}
              {cert.pdfUrl && (
                <a
                  href={cert.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:text-blue-800"
                >
                  <Download size={12} /> {t("certificates.downloadPdf")}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
