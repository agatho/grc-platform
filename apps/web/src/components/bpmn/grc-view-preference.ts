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

import { useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

/** Der Cache-Schlüssel der Voreinstellung; `save` schreibt unter demselben. */
function preferenceKey(processId: string | undefined) {
  return ["processes", processId, "diagram-overlay", "preference"] as const;
}

export function useGrcDiagramPreference(
  processId: string | undefined,
): UseGrcDiagramPreferenceResult {
  const queryClient = useQueryClient();

  // [OP-245 · Gestalt A] Der Ladeversuch läuft über `@tanstack/react-query`
  // statt über einen Effekt, der die Voreinstellung in einen Zustand
  // spiegelte (Muster aus Welle 7b). Ohne Prozessbezug gibt es keinen
  // Endpunkt, den man fragen könnte — dann ist die Abfrage abgeschaltet, und
  // `settled` bleibt falsch: „nicht gefragt" ist nicht „nichts gefunden".
  // Ein Fehlschlag bleibt stumm (siehe Kopf): der Fehlerzustand der Abfrage
  // wird nicht nach außen gereicht, `isFetched` wird trotzdem wahr.
  const { data, isFetched } = useQuery<GrcDiagramPreference | null>({
    queryKey: preferenceKey(processId),
    enabled: Boolean(processId),
    queryFn: async ({ signal }) => {
      // `enabled` schaltet ab; die Prüfung hier verengt nur den Typ.
      if (!processId) return null;
      const res = await fetch(preferenceUrl(processId), { signal });
      if (!res.ok) throw new Error(`preference ${String(res.status)}`);
      const json: unknown = await res.json();
      const body = (json as { data?: Partial<GrcDiagramPreference> }).data;
      if (!body) return null;
      return {
        activeView: (body.activeView ?? null) as GrcViewId | null,
        frameworkCode: body.frameworkCode ?? null,
      };
    },
  });

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
      // Die eigene Wahl landet sofort im Cache — unter demselben Schlüssel,
      // den die Abfrage oben liest — statt in einem gespiegelten Zustand.
      queryClient.setQueryData<GrcDiagramPreference | null>(
        preferenceKey(processId),
        next,
      );
      void fetch(preferenceUrl(processId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {
        // Bewusst stumm — siehe Kopf. Der nächste Wechsel versucht es erneut,
        // weil `lastSent` dann einen anderen Wert trägt.
      });
    },
    [processId, queryClient],
  );

  return { preference: data ?? undefined, settled: isFetched, save };
}
