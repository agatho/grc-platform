"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

/**
 * [ARCTOS-FULL-2026-08-31 · OP-070] Diese Seite stand fest auf ENGLISCH,
 * waehrend der Fragebogen davor (`dd/[token]/page.tsx`) zweisprachig ist. Ein
 * deutschsprachiger Lieferant bearbeitete also einen deutschen Fragebogen und
 * landete auf einer englischen Abschlussmeldung.
 *
 * Der Text musste dabei nicht uebersetzt werden: `portal.expired`,
 * `portal.expiredMessage` und `portal.expiredContact` liegen seit jeher in
 * BEIDEN Katalogen — im englischen Wort fuer Wort so, wie sie hier fest
 * verdrahtet standen. Der Mangel war nie eine fehlende Uebersetzung, sondern
 * eine fehlende Verdrahtung.
 */
export default function DdExpiredPage() {
  const t = useTranslations("portal");
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-red-50 p-4 mb-6">
        <AlertTriangle size={40} className="text-red-500" aria-hidden="true" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-3">{t("expired")}</h1>

      <p className="text-gray-600 max-w-md mb-6">{t("expiredMessage")}</p>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 max-w-md">
        <p className="text-sm text-gray-600">{t("expiredNoContact")}</p>
      </div>
    </div>
  );
}
