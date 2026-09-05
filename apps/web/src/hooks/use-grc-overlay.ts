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

import { useCallback, useEffect, useState } from "react";
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

  const [data, setData] = useState<GrcOverlayData | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!processId || !enabled) {
      setData(undefined);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const query = versionId ? `?version=${encodeURIComponent(versionId)}` : "";
    void (async () => {
      try {
        const res = await fetch(
          `/api/v1/processes/${processId}/diagram-overlay${query}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`overlay ${String(res.status)}`);
        const json: unknown = await res.json();
        const payload = (json as { data?: GrcOverlayData }).data;
        if (cancelled) return;
        // `computedAt` ist Pflichtfeld des Vertrags. Fehlt es, ist die Antwort
        // nicht der Datensatz, für den sie sich ausgibt — dann lieber nichts
        // zeichnen als einen Stand behaupten, den niemand kennt.
        if (!payload || typeof payload.computedAt !== "string") {
          throw new Error("overlay payload without computedAt");
        }
        setData(payload);
      } catch (err) {
        if (cancelled || (err as { name?: string }).name === "AbortError") {
          return;
        }
        setData(undefined);
        setError(err instanceof Error ? err.message : "overlay failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [processId, enabled, versionId, nonce]);

  return { data, loading, error, reload };
}
