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
 */

import type { GrcViewId } from "@grc/bpmn/grc";

export const GRC_VIEW_OPTIONS: ReadonlyArray<{
  readonly id: GrcViewId;
  readonly title: string;
}> = [
  { id: "modeling", title: "Modellierung" },
  { id: "risk-control", title: "Risiko & Kontrolle" },
  { id: "compliance", title: "Compliance & Nachweis" },
  { id: "privacy", title: "Datenschutz" },
  { id: "continuity", title: "Kontinuität (BCM)" },
  { id: "operations", title: "Betrieb & Effizienz" },
  { id: "organization", title: "Organisation & SoD" },
  { id: "architecture", title: "Architektur (EAM)" },
  { id: "responsibility", title: "Verantwortung" },
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
  return (
    <div className={className}>
      <label className="flex items-center gap-1">
        <span className="sr-only">GRC-Sicht</span>
        <select
          aria-label="GRC-Sicht"
          className="rounded border-0 bg-transparent px-1 py-0.5 text-xs text-muted-foreground focus:outline-none"
          value={value ?? ""}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === "" ? null : (next as GrcViewId));
          }}
        >
          <option value="">GRC-Sicht: aus</option>
          {GRC_VIEW_OPTIONS.map((view) => (
            <option key={view.id} value={view.id}>
              {view.title}
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
            ? `GRC-Daten nicht geladen (${error})`
            : loading
              ? "GRC-Daten werden geladen …"
              : computedAt !== undefined
                ? `Stand: ${formatStand(computedAt)}`
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
