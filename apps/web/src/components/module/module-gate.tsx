"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ModuleKey } from "@grc/shared";
import { useModuleConfig } from "@/hooks/use-module-config";
import { ModuleTeaser } from "./module-teaser";
import { PreviewBanner } from "./preview-banner";

interface ModuleGateProps {
  moduleKey: ModuleKey;
  children: ReactNode;
}

/**
 * Conditionally renders children based on the module's UI status.
 *
 * - **enabled**  — renders children as-is
 * - **preview**  — renders a yellow banner + children (read-only context)
 * - **disabled** / **maintenance** — renders the teaser page
 * - **konnte nicht geladen werden** — renders a retryable error (see below)
 */
export function ModuleGate({ moduleKey, children }: ModuleGateProps) {
  const t = useTranslations();
  const { status, loading, error, refetch } = useModuleConfig(moduleKey);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  // [ARCTOS-FULL-2026-08-31 · 2026-09-09] Ein FEHLGESCHLAGENER Abruf ist kein
  // abgeschaltetes Modul.
  //
  // `ModuleConfigProvider` liefert bei einem Fehler eine LEERE Liste plus
  // `error`. Bis hierher wurde nur die Liste gelesen: kein Eintrag zu diesem
  // Schluessel → `status: "disabled"` → Teaser. Damit sagte die Anwendung
  // „dieses Modul ist fuer Ihre Organisation nicht freigeschaltet" — eine
  // Aussage ueber den Vertrag — obwohl in Wahrheit EINE Anfrage
  // fehlgeschlagen war, und zwar eine, die sich wiederholen laesst.
  //
  // Gemessen im E2E-Lauf 34398654753 (W22-C1-03, Finding-Formular): der
  // Abruf von `/api/v1/organizations/<id>/modules` bekam 429, und die
  // Detailseite zeigte 60 Sekunden lang den Teaser mit dem ROHEN
  // Modulschluessel („ics") statt des angelegten Findings. Das ist dieselbe
  // Anzeige, die OP-218 fuer die noch ladende Sitzung abgestellt hat — hier
  // aus der zweiten Quelle, dem Fehler. In Betrieb trifft es jede
  // gate-geschuetzte Seite gleichzeitig, sobald diese eine Anfrage einmal
  // scheitert: die Anwendung sieht dann komplett abbestellt aus.
  //
  // Der Fehler ist ein eigener Zustand: benannt, mit Wiederholung, und ohne
  // Aussage ueber die Freischaltung. `refetch` ist der bereits vorhandene
  // Weg des Anbieters (er prueft `orgId` selbst).
  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 px-4 text-center"
        role="alert"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t("modules.unavailable.title")}
        </h2>
        <p className="text-sm text-gray-500 max-w-md mb-6">
          {t("modules.unavailable.description")}
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          {t("modules.unavailable.retry")}
        </button>
      </div>
    );
  }

  if (status === "enabled") {
    return <>{children}</>;
  }

  if (status === "preview") {
    return (
      <>
        <PreviewBanner moduleKey={moduleKey} />
        {children}
      </>
    );
  }

  // disabled or maintenance
  return <ModuleTeaser moduleKey={moduleKey} />;
}
