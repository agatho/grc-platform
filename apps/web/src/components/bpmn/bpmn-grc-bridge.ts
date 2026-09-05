/**
 * Die Brücke zwischen den heutigen API-Routen und dem Vertrag der
 * GRC-Diagrammschicht (`packages/bpmn/src/grc/contract.ts`, beschrieben in
 * `/work/bpmn-plan/STUFE2-A2-GRC.md` §4.1).
 *
 * **Warum diese Datei überhaupt existiert.** Die GRC-Schicht hat bewusst
 * keinen Datenbankzugriff und kennt weder Drizzle noch `fetch`; sie erwartet
 * einen fertig berechneten Datensatz `GrcOverlayData` — die Nutzlast des im
 * Plan (§3.3.6) vorgesehenen Endpunkts
 * `GET /api/v1/processes/:id/diagram-overlay`. **Diesen Endpunkt gibt es
 * heute nicht**, und ihn anzulegen hieße, eine API-Route zu ändern — das ist
 * hier ausdrücklich verboten. Also baut diese Datei denselben Datensatz aus
 * dem zusammen, was die vorhandenen Routen heute schon liefern:
 *
 * | Feld im Vertrag | heutige Quelle | Zustand |
 * |---|---|---|
 * | `elements[].risks` | `GET /processes/:id/risks` (über `useProcessStepRisks`) | vollständig, außer `controlIds` |
 * | `elements[].controls` | `GET /processes/:id/control-coverage` | **nur Zählwerte** — siehe unten |
 * | `elements[].findings` | `GET /processes/:id/findings` | Schwere und Status ja, `dueAt` nein |
 * | `elements[].lineOfDefense` | `process.steps[].lineOfDefense` | vollständig |
 * | `elements[].calledProcess` | `GET /processes/:id/call-links` | ohne `rollup` |
 * | alle übrigen Felder | — | leer, mit Bedarfsvermerk in `BRIDGE_LIMITS` |
 *
 * **Die eine ehrliche Einschränkung, die man nicht übersehen darf.**
 * `control-coverage` liefert je Aktivität nur `controlCount` und
 * `effectiveCount`, nicht die Kontrollen selbst. `GrcControl` verlangt aber
 * `id`, `title` und `effectiveness` je Kontrolle. Diese Brücke **erfindet
 * keine Titel**: sie erzeugt Platzhalter-Kontrollen mit stabiler, als solche
 * erkennbarer ID (`coverage:<elementId>:<n>`), leerem Titel und der
 * Wirksamkeit, die sich aus den beiden Zählwerten ableiten lässt. Damit
 * rechnet die Abdeckungsampel (F1) richtig, und ein Panel, das die Kontrollen
 * auflisten will, sieht sofort, dass es sie nachladen muss. Die saubere
 * Lösung ist der Endpunkt aus §3.3.6 — hier notiert, nicht gebaut.
 */

import type {
  GrcCalledProcess,
  GrcControl,
  GrcControlEffectiveness,
  GrcElementData,
  GrcFinding,
  GrcFindingSeverity,
  GrcLineOfDefense,
  GrcOverlayData,
  GrcRisk,
  // Unterpfad-Import über den Exports-Eintrag `"./grc"`. Er fehlte
  // (STUFE2-A2-GRC.md §4.3, STUFE2-B2-EINBINDUNG.md §5.1) und zwang diese
  // Datei auf einen relativen Pfad; beides ist erledigt.
} from "@grc/bpmn/grc";

export type { GrcElementData, GrcOverlayData } from "@grc/bpmn/grc";

/* ------------------------------------------------------------------ *
 * Eingangsformen — genau das, was die heutigen Routen liefern
 * ------------------------------------------------------------------ */

/** Ein Eintrag aus `useProcessStepRisks().stepRisks`. */
export interface StepRiskInput {
  readonly bpmnElementId?: string | null;
  readonly risks?: readonly {
    readonly riskId?: string | null;
    readonly riskTitle?: string | null;
    readonly riskScore?: number | null;
    readonly riskStatus?: string | null;
  }[];
}

/** Ein Eintrag aus `GET /processes/:id/control-coverage` → `data.activities`. */
export interface ControlCoverageInput {
  readonly bpmnElementId?: string | null;
  readonly controlCount?: number | null;
  readonly effectiveCount?: number | null;
}

/** Eine Feststellung aus `GET /processes/:id/findings`, plus Schrittbezug. */
export interface FindingInput {
  readonly id?: string | null;
  readonly title?: string | null;
  readonly severity?: string | null;
  readonly status?: string | null;
  readonly process_step_id?: string | null;
  readonly processStepId?: string | null;
}

/** Ein Schritt aus `process.steps` — die Brücke von `process_step_id` zur BPMN-ID. */
export interface ProcessStepInput {
  readonly id?: string | null;
  readonly bpmnElementId?: string | null;
  readonly lineOfDefense?: string | null;
}

/** Ein Eintrag aus `GET /processes/:id/call-links`. */
export interface CallLinkInput {
  readonly bpmnElementId?: string | null;
  readonly calledProcessId?: string | null;
  readonly calledProcessName?: string | null;
}

export interface BuildOverlayDataInput {
  readonly stepRisks?: readonly StepRiskInput[];
  readonly controlCoverage?: readonly ControlCoverageInput[];
  readonly findings?: readonly FindingInput[];
  readonly steps?: readonly ProcessStepInput[];
  readonly callLinks?: readonly CallLinkInput[];
  /**
   * Bezugszeitpunkt. Pflichtfeld im Vertrag: eine Anzeige aus
   * zwischengespeicherten Daten muss ihren Stand nennen können. Als Argument,
   * damit kein Test an `Date.now()` hängt.
   */
  readonly computedAt: string;
}

/* ------------------------------------------------------------------ *
 * Was DIESER Weg nicht kann — und was nur er nicht kann
 * ------------------------------------------------------------------ */

/**
 * [ARCTOS-FULL-2026-08-31 · OP-160] **Hier stand eine zweite, veraltete Liste.**
 *
 * Bis zu dieser Welle führte diese Datei ein eigenes `MISSING_TODAY` mit zehn
 * Einträgen. Acht davon waren gegen den Code nachweislich falsch — sie
 * behaupteten fehlende Tabellen und Spalten, die es seit den Migrationen
 * `0444`–`0454` gibt:
 *
 * | Behauptung der alten Liste | Wirklichkeit |
 * |---|---|
 * | „Es gibt keine Lane-Tabelle (`process_lane`) und keine SoD-Regelmenge (`sod_rule`)" | `0444_process_lane.sql`, `0446_sod_rule.sql` |
 * | „`process_step_raci` fehlt" | `0447_process_step_raci.sql` |
 * | „`process_step.step_key` existiert nicht" | `0445_process_step_identity.sql`; `grc-overlay.ts` liefert `stepKey` |
 * | „`finding.due_at` existiert im Schema nicht" | `grc-overlay.ts:856` liefert `dueAt` |
 * | „`process_step_ropa`, `_bia`, `_document` fehlen" | `0448`, `0449`, `0450` |
 * | „ohne `process_event_activity_map` keine Zuordnungsquote" | `0451_process_event_activity_map.sql` |
 * | „Vorfälle und Maßnahmen haben keinen Elementbezug" | `0454_element_level_links.sql` |
 * | „`/call-links` liefert nur Name und ID" (kein Roll-up) | `grc-overlay.ts:988` rechnet das Roll-up |
 *
 * Die Liste war der Stand vor Stufe E, und sie hatte **keinen Wächter** — der
 * vorhandene Test prüfte nur die Liste in `lib/grc-overlay.ts`. Zwei Listen,
 * von denen eine ungeprüft altert, sind schlimmer als eine unvollständige:
 * wer die falsche liest, hält Funktionen für unmöglich, die es gibt.
 *
 * **Maßgeblich ist `lib/grc-overlay.ts`.** Sie beschreibt, was der Endpunkt
 * `GET /api/v1/processes/:id/diagram-overlay` nicht liefert — die Aussage über
 * das Produkt. Sie wird hier durchgereicht statt nachgebaut.
 */
export { MISSING_TODAY } from "@/lib/grc-overlay";

/**
 * Was **dieser Weg** nicht kann — und zwar nur er.
 *
 * Der Unterschied zu {@link MISSING_TODAY} ist der Grund der Einschränkung:
 * dort steht, was das *Produkt* nicht erhebt; hier steht, was die vier alten
 * Routen nicht ausliefern. Jede Zeile hier verschwindet, sobald eine
 * Aufrufstelle auf den Endpunkt umgestellt ist — keine nennt eine fehlende
 * Tabelle, denn die gibt es alle.
 *
 * Bewusst als auswertbares Datum: `bpmn-engine-switch.test.ts` prüft, dass
 * keine Zeile hier eine Schemalücke behauptet.
 */
export const BRIDGE_LIMITS: ReadonlyArray<{
  readonly field: string;
  readonly reason: string;
}> = [
  {
    field: "elements[].controls[].title",
    reason:
      "GET /control-coverage liefert je Aktivität nur controlCount und effectiveCount, keine Kontrolltitel. Der Endpunkt diagram-overlay liefert sie.",
  },
  {
    field: "elements[].risks[].controlIds",
    reason:
      "Keine der vier alten Routen gibt die Verknüpfung Risiko↔Kontrolle je Schritt aus. Der Endpunkt diagram-overlay rechnet sie (grc-overlay.ts:836).",
  },
  {
    field: "elements[].findings[].dueAt",
    reason:
      "GET /findings liefert Schwere und Status, kein Fälligkeitsdatum. Der Endpunkt diagram-overlay liefert es (grc-overlay.ts:856).",
  },
  {
    field: "elements[].calledProcess.rollup",
    reason:
      "GET /call-links liefert Name und ID; das Aggregat des Zielprozesses wird serverseitig gerechnet und steht nur im Endpunkt diagram-overlay (grc-overlay.ts:988).",
  },
  {
    field:
      "lanes, edges, diagram.*, elements[].{raci,ropa,bia,documents,frameworks,conformance,stepKey,incidents,workItems}",
    reason:
      "Für all das gibt es keine der vier alten Routen — die Daten existieren (Migrationen 0444–0454) und werden vom Endpunkt diagram-overlay ausgeliefert. Diese Brücke liefert die Felder deshalb gar nicht, statt sie leer zu behaupten.",
  },
];

/* ------------------------------------------------------------------ *
 * Die Abbildung
 * ------------------------------------------------------------------ */

const OPEN_FINDING_STATUS = new Set(["open", "in_progress"]);
const CLOSED_FINDING_STATUS = new Set(["closed", "verified", "remediated"]);
const LOD_VALUES = new Set<GrcLineOfDefense>([
  "first",
  "second",
  "third",
  "oversight",
]);
const SEVERITIES = new Set<GrcFindingSeverity>([
  "low",
  "medium",
  "high",
  "critical",
]);

/**
 * Baut `GrcOverlayData` aus den heutigen Antwortformen.
 *
 * Rein: keine Netzaufrufe, kein `Date.now()`, keine Sortierung nach Zufall.
 * Damit ist die Abbildung testbar, und wenn der Endpunkt aus §3.3.6 einmal
 * existiert, wird diese Funktion zu seiner serverseitigen Implementierung —
 * sie ist bewusst nicht an React gebunden.
 */
export function buildGrcOverlayData(
  input: BuildOverlayDataInput,
): GrcOverlayData {
  const elements = new Map<string, Mutable<GrcElementData>>();
  const at = (id: string): Mutable<GrcElementData> => {
    let entry = elements.get(id);
    if (!entry) {
      entry = {};
      elements.set(id, entry);
    }
    return entry;
  };

  // --- Risiken ------------------------------------------------------------
  for (const step of input.stepRisks ?? []) {
    const id = nonEmpty(step.bpmnElementId);
    if (!id) continue;
    const risks: GrcRisk[] = [];
    for (const risk of step.risks ?? []) {
      const riskId = nonEmpty(risk.riskId);
      if (!riskId) continue;
      risks.push({
        id: riskId,
        title: nonEmpty(risk.riskTitle) ?? riskId,
        // `riskScore` der Route ist der Nettoscore; der Bruttoscore wird nicht
        // ausgeliefert und bleibt deshalb weg statt gleichgesetzt zu werden.
        residualScore: numberOr(risk.riskScore, 0),
      });
    }
    if (risks.length > 0) at(id).risks = risks;
  }

  // --- Kontrollabdeckung --------------------------------------------------
  for (const coverage of input.controlCoverage ?? []) {
    const id = nonEmpty(coverage.bpmnElementId);
    if (!id) continue;
    const total = Math.max(0, numberOr(coverage.controlCount, 0));
    if (total === 0) continue;
    const effective = clamp(numberOr(coverage.effectiveCount, 0), 0, total);
    at(id).controls = placeholderControls(id, total, effective);
  }

  // --- Feststellungen -----------------------------------------------------
  const stepToElement = new Map<string, string>();
  for (const step of input.steps ?? []) {
    const stepId = nonEmpty(step.id);
    const elementId = nonEmpty(step.bpmnElementId);
    if (stepId && elementId) stepToElement.set(stepId, elementId);
  }
  const findingsByElement = new Map<string, GrcFinding[]>();
  for (const finding of input.findings ?? []) {
    const stepId =
      nonEmpty(finding.process_step_id) ?? nonEmpty(finding.processStepId);
    if (!stepId) continue;
    const elementId = stepToElement.get(stepId);
    if (!elementId) continue;
    const id = nonEmpty(finding.id);
    if (!id) continue;
    const list = findingsByElement.get(elementId) ?? [];
    list.push({
      id,
      title: nonEmpty(finding.title) ?? id,
      severity: toSeverity(finding.severity),
      status: toFindingStatus(finding.status),
    });
    findingsByElement.set(elementId, list);
  }
  for (const [elementId, list] of findingsByElement) {
    at(elementId).findings = list;
  }

  // --- Line of Defense ----------------------------------------------------
  for (const step of input.steps ?? []) {
    const id = nonEmpty(step.bpmnElementId);
    const lod = nonEmpty(step.lineOfDefense);
    if (!id || !lod) continue;
    if (LOD_VALUES.has(lod as GrcLineOfDefense)) {
      at(id).lineOfDefense = lod as GrcLineOfDefense;
    }
  }

  // --- Call Activity ------------------------------------------------------
  for (const link of input.callLinks ?? []) {
    const id = nonEmpty(link.bpmnElementId);
    const processId = nonEmpty(link.calledProcessId);
    if (!id || !processId) continue;
    const called: GrcCalledProcess = {
      processId,
      name: nonEmpty(link.calledProcessName) ?? processId,
    };
    at(id).calledProcess = called;
  }

  return {
    computedAt: input.computedAt,
    elements: Object.fromEntries(elements) as GrcOverlayData["elements"],
  };
}

/**
 * Platzhalter-Kontrollen aus reinen Zählwerten.
 *
 * `effectiveness` ist die einzige Angabe, die aus `controlCount`/
 * `effectiveCount` wirklich folgt. Der Titel bleibt leer — ein erfundener
 * Titel („Kontrolle 1") wäre in einem Prüfungswerkzeug schlimmer als eine
 * sichtbare Lücke. Die ID trägt das Präfix `coverage:`, damit jede Stelle,
 * die sie weiterreicht, an ihr erkennt, dass sie kein `control.id` ist.
 */
function placeholderControls(
  elementId: string,
  total: number,
  effective: number,
): GrcControl[] {
  const out: GrcControl[] = [];
  for (let index = 0; index < total; index += 1) {
    const effectiveness: GrcControlEffectiveness =
      index < effective ? "effective" : "untested";
    out.push({
      id: `coverage:${elementId}:${String(index)}`,
      title: "",
      effectiveness,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Kleinteile
 * ------------------------------------------------------------------ */

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function nonEmpty(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function numberOr(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toSeverity(value: string | null | undefined): GrcFindingSeverity {
  const normalized = nonEmpty(value)?.toLowerCase();
  return normalized && SEVERITIES.has(normalized as GrcFindingSeverity)
    ? (normalized as GrcFindingSeverity)
    : "medium";
}

/**
 * Der Vertrag kennt drei Zustände, die Route mehr (`verified`, `remediated`).
 * Alles, was die Seite heute als „nicht offen" zählt, wird `closed`; alles
 * Unbekannte bleibt `open`, weil eine übersehene Feststellung teurer ist als
 * eine zu viel angezeigte.
 */
function toFindingStatus(
  value: string | null | undefined,
): GrcFinding["status"] {
  const normalized = nonEmpty(value)?.toLowerCase();
  if (!normalized) return "open";
  if (CLOSED_FINDING_STATUS.has(normalized)) return "closed";
  if (OPEN_FINDING_STATUS.has(normalized)) {
    return normalized as GrcFinding["status"];
  }
  return "open";
}
