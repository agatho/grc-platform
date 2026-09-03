"use client";

/**
 * Das Gedächtnis der GRC-Sichtwahl.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-003] `user_diagram_preference` steht seit
 * Migration 0452 — und wurde von niemandem geschrieben. Nachgemessen: außerhalb
 * von `packages/db/src/schema/process-diagram-grc.ts` gab es im ganzen
 * Repository keine Referenz auf die Tabelle. `GrcViewSelect` hielt seine Wahl
 * in einem React-`useState`, und der ist beim Seitenwechsel weg. Wer die Sicht
 * „Datenschutz" einstellt, in einen anderen Prozess springt und zurückkommt,
 * beginnt wieder bei „aus".
 *
 * [ARCTOS-FULL-2026-08-31 · OP-016] Dieselbe Zeile trägt seit Migration 0475
 * das gewählte Rahmenwerk der Sicht F8.
 *
 * **Drei Festlegungen, die nicht offensichtlich sind.**
 *
 * - **Ein Fehlschlag ist folgenlos.** Eine Anzeigevoreinstellung ist kein
 *   Nachweis (Kopf von 0452: „Audit-Trigger: NEIN, und zwar ohne Abwägung").
 *   Wenn Laden oder Speichern scheitert, arbeitet die Fläche mit der Wahl im
 *   Zustand weiter — eine Diagrammfläche, die stehenbleibt, weil eine
 *   Voreinstellung nicht gespeichert werden konnte, wäre die deutlich
 *   schlechtere Eigenschaft. Deshalb kein `error` nach außen.
 * - **Gespeichert wird beim Wechsel, nicht beim Rendern.** Ein Effekt, der die
 *   aktuelle Wahl fortlaufend zurückschreibt, überschriebe eine gerade in
 *   einem anderen Reiter getroffene Wahl mit dem eigenen Anfangszustand.
 * - **Die geladene Wahl wird genau einmal angewandt**, und nur wenn der
 *   Aufrufer noch keine hat. Sonst überschriebe die Voreinstellung eine
 *   ausdrückliche Wahl, die der Nutzer in derselben Sitzung getroffen hat —
 *   das wäre eine Oberfläche, die die eigene Eingabe zurücknimmt.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { GrcViewId } from "@grc/bpmn/grc";

export interface GrcDiagramPreference {
  readonly activeView: GrcViewId | null;
  readonly frameworkCode: string | null;
}

export interface UseGrcDiagramPreferenceResult {
  /** Die geladene Voreinstellung, sobald sie da ist. */
  readonly preference: GrcDiagramPreference | undefined;
  /** Ob der Ladeversuch abgeschlossen ist — auch, wenn er scheiterte. */
  readonly settled: boolean;
  /** Speichert; Fehler bleiben absichtlich stumm (siehe Kopf). */
  readonly save: (next: GrcDiagramPreference) => void;
}

/** Der Pfad ist Teil des Overlay-Endpunkts, nicht eine eigene Ressource. */
export function preferenceUrl(processId: string): string {
  return `/api/v1/processes/${encodeURIComponent(processId)}/diagram-overlay/preference`;
}

export function useGrcDiagramPreference(
  processId: string | undefined,
): UseGrcDiagramPreferenceResult {
  const [preference, setPreference] = useState<
    GrcDiagramPreference | undefined
  >(undefined);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!processId) {
      // Ohne Prozessbezug gibt es keinen Endpunkt, den man fragen könnte.
      // `settled` bleibt falsch: „nicht gefragt" ist nicht „nichts gefunden".
      setPreference(undefined);
      setSettled(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(preferenceUrl(processId), {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`preference ${String(res.status)}`);
        const json: unknown = await res.json();
        const data = (json as { data?: Partial<GrcDiagramPreference> }).data;
        if (cancelled || !data) return;
        setPreference({
          activeView: (data.activeView ?? null) as GrcViewId | null,
          frameworkCode: data.frameworkCode ?? null,
        });
      } catch {
        // Bewusst stumm. Die Wahl im Zustand bleibt gültig.
      } finally {
        if (!cancelled) setSettled(true);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [processId]);

  // Der zuletzt gesendete Stand, damit ein doppelter Wechsel auf denselben
  // Wert (Sichtwahl in zwei Reitern derselben Seite) nicht zweimal schreibt.
  const lastSent = useRef<string | undefined>(undefined);

  const save = useCallback(
    (next: GrcDiagramPreference) => {
      if (!processId) return;
      const body = JSON.stringify({
        activeView: next.activeView,
        frameworkCode: next.frameworkCode,
      });
      if (lastSent.current === body) return;
      lastSent.current = body;
      setPreference(next);
      void fetch(preferenceUrl(processId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {
        // Bewusst stumm — siehe Kopf. Der nächste Wechsel versucht es erneut,
        // weil `lastSent` dann einen anderen Wert trägt.
      });
    },
    [processId],
  );

  return { preference, settled, save };
}
