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
 * | alle übrigen Felder | — | leer, mit Bedarfsvermerk in `MISSING_TODAY` |
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
 * Was heute fehlt — als Datum, nicht als Kommentar
 * ------------------------------------------------------------------ */

/**
 * Vertragsfelder, die diese Brücke **nicht** befüllen kann, mit dem Grund.
 *
 * Bewusst eine auswertbare Liste und kein Fließtext: sie steht so auch im
 * Protokoll, und ein Test kann prüfen, dass jedes hier genannte Feld im
 * Ergebnis tatsächlich fehlt statt still mit einem Ersatzwert dazustehen.
 */
export const MISSING_TODAY: ReadonlyArray<{
  readonly field: string;
  readonly reason: string;
}> = [
  {
    field: "elements[].controls[].title",
    reason:
      "GET /control-coverage liefert nur Zählwerte je Aktivität, keine Kontrolltitel.",
  },
  {
    field: "elements[].risks[].controlIds",
    reason:
      "Die Verknüpfung Risiko↔Kontrolle je Schritt (process_step_risk ⋈ process_step_control) wird von keiner Route ausgeliefert; sie ist der Join aus Plan §3.3.6.",
  },
  {
    field: "elements[].findings[].dueAt",
    reason: "finding.due_at existiert im Schema nicht (Schemabedarf §5.2).",
  },
  {
    field: "elements[].calledProcess.rollup",
    reason:
      "Das Aggregat des Zielprozesses muss serverseitig gerechnet werden; /call-links liefert nur Name und ID.",
  },
  {
    field: "elements[].assets, .raci.consulted, .raci.informed",
    reason:
      "Assets nur über GET /steps/:id/assets (eine Route je Schritt, N+1); C und I haben keine DB-Heimat (process_step_raci fehlt).",
  },
  {
    field: "elements[].ropa, .bia, .documents, .frameworks, .comments",
    reason:
      "Alle vier hängen heute am Prozess, nicht am Element (Schemabedarf §5.2: process_step_ropa, process_step_bia, process_step_document, process_framework_mapping.process_step_id).",
  },
  {
    field: "elements[].conformance",
    reason:
      "process_event.activity ist ein Name, keine BPMN-ID; ohne process_event_activity_map ist keine Zuordnungsquote berechenbar — die GRC-Schicht liefert F7 deshalb bewusst gar nicht aus.",
  },
  {
    field: "elements[].incidents, .workItems, .simulation, .dmnDecision",
    reason:
      "Simulation und DMN sind im Schema am Element vorhanden, aber ohne Route für die Diagrammfläche; Vorfälle und Maßnahmen haben keinen Elementbezug.",
  },
  {
    field: "lanes, edges, diagram.sodRules, diagram.outage",
    reason:
      "Es gibt keine Lane-Tabelle (process_lane) und keine SoD-Regelmenge (sod_rule). Ohne sie sind Vertrauensgrenzen, Aufgabentrennung und Ausfallsimulation datenlos — die Brücke liefert die Felder deshalb leer statt geraten.",
  },
  {
    field: "elements[].stepKey",
    reason:
      "process_step.step_key existiert nicht; Schlüssel bleibt die BPMN-Element-ID.",
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
