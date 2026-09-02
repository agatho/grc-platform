"use client";

/**
 * Die Sichtwahl über der Diagrammfläche.
 *
 * Die GRC-Diagrammschicht kennt neun Sichten (Plan §3.3.3). Welche davon
 * gerade gilt, ist eine Entscheidung des Lesers und nicht der Seite — dieses
 * Auswahlfeld ist der Ort dafür. `null` bedeutet ausdrücklich **aus**: dann
 * wird der Overlay-Endpunkt gar nicht erst befragt und die Fläche zeigt die
 * fünf HTML-Badgekanäle wie bisher.
 *
 * **Warum die Liste hier steht und nicht aus `@grc/bpmn/grc` kommt.** Ein
 * Wertimport von `GRC_VIEWS` zöge die gesamte GRC-Schicht (23 Layer) in das
 * Bündel jeder Prozessseite — auch dort, wo niemand eine Sicht einschaltet.
 * Die Fläche lädt das Modul dynamisch, und dabei soll es bleiben. `GrcViewId`
 * wird deshalb nur als **Typ** importiert (zur Bauzeit gelöscht); ein Test
 * hält die Liste gegen `GRC_VIEWS` und schlägt fehl, sobald eine Sicht
 * dazukommt oder wegfällt.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-071] Die Beschriftungen standen bis hierher
 * fest verdrahtet auf Deutsch im Code — die Liste trug neben der Kennung auch
 * den Titel. Sie kommen jetzt aus `messages/<locale>/bpmn.json` unter
 * `grcView.views.<id>`. Der Schlüssel wird zur Laufzeit zusammengesetzt und
 * ist damit für `scripts/audit-i18n-usage.mjs` eine dynamische Aufrufstelle;
 * den Nachweis, dass zu jeder Sicht in **beiden** Sprachen eine Beschriftung
 * existiert, führt deshalb der Test, nicht das Tor.
 */

import { useTranslations } from "next-intl";
import type { GrcViewId } from "@grc/bpmn/grc";

/**
 * Die neun Sichten in Anzeigereihenfolge. Bewusst nur die Kennungen: der Titel
 * ist Übersetzungsgut und hat im Code nichts verloren.
 */
export const GRC_VIEW_OPTIONS: readonly GrcViewId[] = [
  "modeling",
  "risk-control",
  "compliance",
  "privacy",
  "continuity",
  "operations",
  "organization",
  "architecture",
  "responsibility",
];

export interface GrcViewSelectProps {
  value: GrcViewId | null;
  onChange: (value: GrcViewId | null) => void;
  /** Stand des Datensatzes (`computedAt`), sobald er geladen ist. */
  computedAt?: string | undefined;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export function GrcViewSelect({
  value,
  onChange,
  computedAt,
  loading = false,
  error = null,
  className,
}: GrcViewSelectProps) {
  const t = useTranslations("bpmn");
  const label = t("grcView.label");

  return (
    <div className={className}>
      <label className="flex items-center gap-1">
        <span className="sr-only">{label}</span>
        <select
          aria-label={label}
          className="rounded border-0 bg-transparent px-1 py-0.5 text-xs text-muted-foreground focus:outline-none"
          value={value ?? ""}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === "" ? null : (next as GrcViewId));
          }}
        >
          <option value="">{t("grcView.off")}</option>
          {GRC_VIEW_OPTIONS.map((id) => (
            <option key={id} value={id}>
              {t(`grcView.views.${id}`)}
            </option>
          ))}
        </select>
      </label>
      {/*
        Der Stand gehört sichtbar neben die Auswahl: ein Diagramm mit
        stillschweigend veralteten Kontrollständen ist ein Prüfungsrisiko
        (Vertrag §4.1, `computedAt` ist Pflichtfeld).
      */}
      {value !== null && (
        <p className="px-1 text-[10px] leading-tight text-muted-foreground">
          {error !== null
            ? t("grcView.error", { reason: error })
            : loading
              ? t("grcView.loading")
              : computedAt !== undefined
                ? t("grcView.computedAt", {
                    timestamp: formatStand(computedAt),
                  })
                : ""}
        </p>
      )}
    </div>
  );
}

/** Lokale Zeitangabe ohne Bibliothek; ungültige Eingabe bleibt sichtbar. */
export function formatStand(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return new Date(parsed).toLocaleString();
}
