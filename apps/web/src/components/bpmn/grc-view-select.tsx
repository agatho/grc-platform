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
 *
 * [ARCTOS-FULL-2026-08-31 · OP-003] Die Wahl überlebt jetzt den Seitenwechsel.
 * Sie wird über `useGrcDiagramPreference` in `user_diagram_preference` (0452)
 * abgelegt und beim ersten Laden angewandt — aber nur, wenn der Aufrufer noch
 * keine eigene Wahl hat.
 *
 * **Warum die Prozesskennung notfalls aus der Route kommt.** Die Einbindungen
 * auf der Prozessseite reichen sie nicht als Prop durch. Ein Gedächtnis, das
 * nur an einer von vier Flächen wirkt, wäre keins — deshalb fällt die
 * Komponente auf `useParams()` zurück. Ohne Prozessbezug (die Komponente steht
 * dann außerhalb einer `/processes/[id]`-Route) wird nichts geladen und nichts
 * gespeichert; die Wahl verhält sich wie vorher.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-016] Zweites Auswahlfeld: das Rahmenwerk der
 * Sicht F8. Es erscheint nur in der Sicht, die den Layer `framework`
 * überhaupt führt — ein Rahmenwerk zu wählen, das nichts einfärbt, wäre ein
 * Bedienelement ohne Wirkung.
 */

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { GrcViewId } from "@grc/bpmn/grc";

import { useGrcDiagramPreference } from "./grc-view-preference";

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

/**
 * Die Sichten, die den Layer `framework` führen — nur dort ist eine
 * Rahmenwerkauswahl wirksam.
 *
 * Wie `GRC_VIEW_OPTIONS` eine bewusste Wiederholung aus `GRC_VIEWS`, aus
 * demselben Bündelgrund und mit demselben Wächter: ein Test liest `GRC_VIEWS`
 * und prüft, dass genau diese Sichten `framework` aktivieren.
 */
export const GRC_VIEWS_WITH_FRAMEWORK: readonly GrcViewId[] = ["compliance"];

/** Ein wählbares Rahmenwerk, so wie der Overlay-Endpunkt es kennt. */
export interface GrcFrameworkOption {
  readonly code: string;
  readonly name: string;
}

export interface GrcViewSelectProps {
  value: GrcViewId | null;
  onChange: (value: GrcViewId | null) => void;
  /** Stand des Datensatzes (`computedAt`), sobald er geladen ist. */
  computedAt?: string | undefined;
  loading?: boolean;
  error?: string | null;
  className?: string;
  /**
   * Prozess, dessen Voreinstellung gilt. Fehlt das Prop, wird die Kennung aus
   * der Route gelesen; fehlt auch die, gibt es kein Gedächtnis (siehe Kopf).
   */
  processId?: string | undefined;
  /**
   * Wird nach einer Rahmenwerkauswahl gerufen, damit die aufrufende Fläche
   * den Overlay-Datensatz neu holt.
   *
   * **Warum das ein Prop ist und kein Effekt hier.** Der Datensatz gehört dem
   * Aufrufer (`useGrcOverlay`), nicht diesem Auswahlfeld. Wo das Prop fehlt —
   * heute an den beiden Einbindungen in `processes/[id]/page.tsx`, fremde
   * Dateihoheit — wirkt die Wahl beim nächsten Laden; gespeichert ist sie
   * sofort. Übergabe, siehe `docs/UMSETZUNG-WELLE-3B.md`.
   */
  onReloadRequest?: (() => void) | undefined;
}

export function GrcViewSelect({
  value,
  onChange,
  computedAt,
  loading = false,
  error = null,
  className,
  processId,
  onReloadRequest,
}: GrcViewSelectProps) {
  const t = useTranslations("bpmn");
  const label = t("grcView.label");

  // `useParams()` liefert auf `/processes/[id]` die Kennung, außerhalb einer
  // dynamischen Route ein leeres Objekt. Beides ist hier zulässig.
  const params = useParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const resolvedProcessId = processId ?? routeId;

  const { preference, settled, save } =
    useGrcDiagramPreference(resolvedProcessId);
  const [framework, setFramework] = useState<string | null>(null);
  const [options, setOptions] = useState<readonly GrcFrameworkOption[]>([]);

  // Die geladene Voreinstellung wird genau einmal angewandt.
  const applied = useRef(false);
  // Die aktuelle Wahl als Referenz, damit der Effekt unten nicht von ihr
  // abhängen muss: er soll auf die *Ankunft* der Voreinstellung reagieren,
  // nicht auf jede spätere Änderung der Wahl.
  const current = useRef<{
    value: GrcViewId | null;
    onChange: (next: GrcViewId | null) => void;
  }>({ value, onChange });
  current.current = { value, onChange };

  useEffect(() => {
    if (applied.current || !settled || !preference) return;
    applied.current = true;
    setFramework(preference.frameworkCode);
    // Nur, wenn der Aufrufer noch keine Wahl hat: eine Voreinstellung, die
    // eine ausdrückliche Wahl derselben Sitzung überschreibt, wäre eine
    // Oberfläche, die die eigene Eingabe zurücknimmt.
    if (current.current.value === null && preference.activeView !== null) {
      current.current.onChange(preference.activeView);
    }
  }, [settled, preference]);

  const showFramework =
    value !== null && GRC_VIEWS_WITH_FRAMEWORK.includes(value);

  // Die wählbaren Rahmenwerke sind die, die dieser Prozess überhaupt zuordnet.
  // Sie kommen aus dem Overlay-Endpunkt mit `?layers=framework` — zwei
  // Abfragen statt 23 — und nur, wenn das Feld auch gezeigt wird. Eine feste
  // Liste aller Kataloge anzubieten wäre die bequemere und schlechtere Lösung:
  // sie böte Rahmenwerke an, zu denen dieser Prozess keine einzige Zuordnung
  // führt, und der Abdeckungsgrad wäre dann „0 von 0".
  useEffect(() => {
    if (!showFramework || !resolvedProcessId) return;
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(
          `/api/v1/processes/${encodeURIComponent(resolvedProcessId)}/diagram-overlay?layers=framework`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`overlay ${String(res.status)}`);
        const json: unknown = await res.json();
        const elements =
          (
            json as {
              data?: {
                elements?: Record<
                  string,
                  | {
                      frameworks?: readonly {
                        frameworkId: string;
                        frameworkName: string;
                      }[];
                    }
                  | undefined
                >;
              };
            }
          ).data?.elements ?? {};
        const byCode = new Map<string, string>();
        for (const element of Object.values(elements)) {
          for (const mapping of element?.frameworks ?? []) {
            if (!byCode.has(mapping.frameworkId)) {
              byCode.set(mapping.frameworkId, mapping.frameworkName);
            }
          }
        }
        if (cancelled) return;
        setOptions(
          [...byCode.entries()]
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      } catch {
        // Stumm: eine leere Auswahlliste zeigt gar kein Feld, und das ist
        // ehrlicher als eine Liste, die man nicht belegen kann.
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [showFramework, resolvedProcessId]);

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          <span className="sr-only">{label}</span>
          <select
            aria-label={label}
            className="rounded border-0 bg-transparent px-1 py-0.5 text-xs text-muted-foreground focus:outline-none"
            value={value ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              const next = raw === "" ? null : (raw as GrcViewId);
              onChange(next);
              save({ activeView: next, frameworkCode: framework });
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
        {showFramework && options.length > 0 && (
          <label className="flex items-center gap-1">
            <span className="sr-only">{t("grcView.frameworkLabel")}</span>
            <select
              aria-label={t("grcView.frameworkLabel")}
              className="rounded border-0 bg-transparent px-1 py-0.5 text-xs text-muted-foreground focus:outline-none"
              value={framework ?? ""}
              onChange={(event) => {
                const raw = event.target.value;
                const next = raw === "" ? null : raw;
                setFramework(next);
                save({ activeView: value, frameworkCode: next });
                onReloadRequest?.();
              }}
            >
              <option value="">{t("grcView.frameworkOff")}</option>
              {options.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
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
