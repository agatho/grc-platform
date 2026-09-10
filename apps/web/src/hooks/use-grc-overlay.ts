"use client";

/**
 * Der Datenweg zur GRC-Diagrammschicht.
 *
 * `decorateGrc` ist seit `STUFE2-C-ABSCHLUSS.md` §1.3 verdrahtet, bekam aber
 * nie Daten: der Endpunkt aus Plan §3.3.6 fehlte, also reichte keine Seite
 * einen Datensatz durch, und die 23 Layer waren unsichtbar. Dieser Haken holt
 * ihn — **ein** Aufruf, nicht vier, und ohne jede Umrechnung im Browser: die
 * Antwort ist bereits `GrcOverlayData`.
 *
 * Drei Festlegungen, die nicht offensichtlich sind:
 *
 * - **`enabled` schaltet den Aufruf ab, nicht nur die Anzeige.** Solange
 *   niemand eine GRC-Sicht sehen will, soll die Seite auch keine Abfrage
 *   auslösen; die vier bisherigen Badge-Routen laufen dann wie bisher.
 * - **Ein Fehlschlag ist kein leerer Datensatz.** `data` bleibt `undefined`,
 *   und die Fläche zeichnet ihre HTML-Badges weiter. Ein leerer Datensatz
 *   hieße „keine Risiken, keine Kontrollen" — das ist eine Aussage, und eine
 *   falsche.
 * - **Kein Polling.** `ttlSeconds` steht in der Antwort und die Kopfzeile der
 *   Legende nennt `computedAt`; wer einen frischeren Stand will, lädt neu.
 *   Ein Diagramm, das sich unter der Hand ändert, während jemand es liest,
 *   ist in einem Prüfungswerkzeug die schlechtere Eigenschaft.
 */

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GrcOverlayData } from "@grc/bpmn/grc";

export interface UseGrcOverlayResult {
  data: GrcOverlayData | undefined;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useGrcOverlay(
  processId: string | undefined,
  options: { enabled?: boolean; versionId?: string | undefined } = {},
): UseGrcOverlayResult {
  const enabled = options.enabled ?? true;
  const versionId = options.versionId;
  const active = Boolean(processId) && enabled;

  // [OP-245 · Gestalt A] Der Abruf läuft über `@tanstack/react-query` statt
  // über einen Effekt, der Daten-, Lade- und Fehlerzustand spiegelte (Muster
  // aus Welle 7b). `enabled` schaltet wie vorher den Aufruf ab; Prozess und
  // Version stehen im Schlüssel; das Abbruchsignal der Abfrage ersetzt den
  // eigenen `AbortController`. Die drei Festlegungen im Kopf gelten
  // unverändert: ohne `active` gibt es weder Daten noch Fehler noch Laden,
  // ein Fehlschlag liefert `data === undefined`, und es wird nicht gepollt.
  const {
    data: loaded,
    error: queryError,
    isFetching,
    refetch,
  } = useQuery<GrcOverlayData>({
    queryKey: ["processes", processId, "diagram-overlay", versionId ?? null],
    enabled: active,
    queryFn: async ({ signal }) => {
      const query = versionId
        ? `?version=${encodeURIComponent(versionId)}`
        : "";
      const res = await fetch(
        `/api/v1/processes/${processId}/diagram-overlay${query}`,
        { signal },
      );
      if (!res.ok) throw new Error(`overlay ${String(res.status)}`);
      const json: unknown = await res.json();
      const payload = (json as { data?: GrcOverlayData }).data;
      // `computedAt` ist Pflichtfeld des Vertrags. Fehlt es, ist die Antwort
      // nicht der Datensatz, für den sie sich ausgibt — dann lieber nichts
      // zeichnen als einen Stand behaupten, den niemand kennt.
      if (!payload || typeof payload.computedAt !== "string") {
        throw new Error("overlay payload without computedAt");
      }
      return payload;
    },
  });

  const reload = useCallback(() => {
    // Wie vorher: ohne Prozessbezug oder abgeschaltet löst `reload` nichts
    // aus — `refetch` würde eine abgeschaltete Abfrage sonst trotzdem laden.
    if (!active) return;
    void refetch();
  }, [active, refetch]);

  const error =
    active && queryError
      ? queryError instanceof Error
        ? queryError.message
        : "overlay failed"
      : null;

  return {
    data: active && !queryError ? loaded : undefined,
    loading: active && isFetching,
    error,
    reload,
  };
}
