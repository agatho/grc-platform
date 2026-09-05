/**
 * Die Rechenkerne der GRC-Funktionen — ohne DOM, ohne Datenbank, ohne Zeitzone.
 *
 * Bewusst getrennt von der Zeichenschicht: die fachlich heiklen Stellen (was
 * heißt „abgedeckt", wann ist ein Nachweis „überfällig", was erbt eine Call
 * Activity) sollen für sich prüfbar sein. Jede Funktion hier ist rein und nimmt
 * den Bezugszeitpunkt als Argument entgegen — ein Test, der von `Date.now()`
 * abhängt, ist kein Test.
 */

import type { BpmnShape } from "../draw/types";
import type {
  GrcControl,
  GrcElementData,
  GrcFinding,
  GrcFrameworkMapping,
  GrcFrameworkSelection,
  GrcIncident,
  GrcKri,
  GrcObservedTransition,
  GrcOverlayData,
  GrcRisk,
  GrcRopa,
  GrcWorkItem,
} from "./contract";
import { descendants, type GrcGraph } from "./graph";

/** Ab diesem Restscore gilt ein Risiko als hoch (heutige Ampelschwelle). */
export const HIGH_RISK_SCORE = 15;
/** Ab diesem Restscore gilt ein Risiko als mittel. */
export const MEDIUM_RISK_SCORE = 9;

/* ------------------------------------------------------------------ *
 * F1 — Kontrollabdeckung
 * ------------------------------------------------------------------ */

export type CoverageStage = "none" | "full" | "partial" | "uncovered";

export interface CoverageResult {
  readonly stage: CoverageStage;
  /** Abgedeckter Anteil des Restrisikos, 0…1; `undefined` ohne Risiken. */
  readonly ratio: number | undefined;
  readonly totalScore: number;
  readonly coveredScore: number;
  readonly riskCount: number;
  readonly controlCount: number;
  readonly effectiveControlCount: number;
  readonly keyControlCount: number;
  /** Risiken ohne *wirksame* Kontrolle — der eigentliche Befund. */
  readonly uncoveredRisks: readonly GrcRisk[];
}

/**
 * Kontrollabdeckung je Schritt (Plan §3.4/A2, F1).
 *
 * ```
 * abdeckung = Σ residualScore der Risiken mit ≥1 wirksamer Kontrolle
 *             ───────────────────────────────────────────────────────
 *             Σ residualScore aller Risiken am Schritt
 * ```
 *
 * Zwei Festlegungen, die der Plan offenlässt und die hier bewusst getroffen
 * werden:
 *
 * - Ein Risiko *ohne* `controlIds` gilt als unkontrolliert. Alles andere würde
 *   fehlende Daten als Entwarnung lesen.
 * - Ein unkontrolliertes Risiko mit Restscore ≥ {@link HIGH_RISK_SCORE} setzt
 *   die Stufe auf `uncovered`, auch wenn die Quote rechnerisch gut aussieht.
 *   Sonst verschwindet genau der Befund, wegen dem man das Diagramm öffnet,
 *   hinter dem Durchschnitt vieler kleiner abgedeckter Risiken.
 */
export function computeCoverage(
  element: GrcElementData | undefined,
): CoverageResult {
  const risks = element?.risks ?? [];
  const controls = element?.controls ?? [];
  const effective = new Set(
    controls
      .filter((control) => control.effectiveness === "effective")
      .map((control) => control.id),
  );

  let totalScore = 0;
  let coveredScore = 0;
  const uncovered: GrcRisk[] = [];

  for (const risk of risks) {
    const score = Math.max(0, risk.residualScore);
    totalScore += score;
    const covered = (risk.controlIds ?? []).some((id) => effective.has(id));
    if (covered) {
      coveredScore += score;
    } else {
      uncovered.push(risk);
    }
  }

  const ratio = totalScore > 0 ? coveredScore / totalScore : undefined;
  const severeUncovered = uncovered.some(
    (risk) => risk.residualScore >= HIGH_RISK_SCORE,
  );

  let stage: CoverageStage;
  if (risks.length === 0) {
    stage = "none";
  } else if (severeUncovered) {
    stage = "uncovered";
  } else if (ratio === undefined) {
    // Risiken ohne Bewertung: die Quote ist nicht rechenbar, die Aussage
    // „Risiko vorhanden, Wirksamkeit unbekannt" bleibt trotzdem wahr.
    stage = uncovered.length > 0 ? "partial" : "full";
  } else if (ratio >= 1) {
    stage = "full";
  } else if (ratio <= 0) {
    stage = "uncovered";
  } else {
    stage = "partial";
  }

  return {
    stage,
    ratio,
    totalScore,
    coveredScore,
    riskCount: risks.length,
    controlCount: controls.length,
    effectiveControlCount: effective.size,
    keyControlCount: controls.filter((control) => control.isKey === true)
      .length,
    uncoveredRisks: uncovered,
  };
}

/* ------------------------------------------------------------------ *
 * F2 — Risikoprofil und Roll-up
 * ------------------------------------------------------------------ */

export interface RiskProfile {
  readonly count: number;
  readonly maxResidual: number;
  readonly sumResidual: number;
  /** `own` = am Element selbst, `rolled-up` = aus Kindern/Zielprozess geerbt. */
  readonly origin: "own" | "rolled-up" | "mixed";
  /** Woher die geerbten Anteile stammen (für die Beschreibung). */
  readonly inheritedFrom: readonly string[];
}

export function riskProfileOf(
  element: GrcElementData | undefined,
): RiskProfile {
  const risks = element?.risks ?? [];
  return {
    count: risks.length,
    maxResidual: risks.reduce(
      (max, risk) => Math.max(max, risk.residualScore),
      0,
    ),
    sumResidual: risks.reduce((sum, risk) => sum + risk.residualScore, 0),
    origin: "own",
    inheritedFrom: [],
  };
}

/**
 * Risiko-Roll-up über SubProcess, Lane und CallActivity (F2, §3.4/A5).
 *
 * Das ist die Aussage, die ein generischer Editor nicht treffen kann: Ein
 * Prozess, der einen unkontrollierten Teilprozess aufruft, ist selbst nicht
 * kontrolliert. Für Container wird über die geometrisch enthaltenen Elemente
 * aggregiert, für Call Activities über das serverseitig gelieferte Aggregat des
 * Zielprozesses.
 */
export function rollupRisk(
  graph: GrcGraph,
  data: GrcOverlayData,
  shape: BpmnShape,
): RiskProfile {
  const own = riskProfileOf(data.elements[shape.id]);
  let count = own.count;
  let max = own.maxResidual;
  let sum = own.sumResidual;
  const inherited: string[] = [];

  for (const child of descendants(graph, shape.id)) {
    const profile = riskProfileOf(data.elements[child.id]);
    if (profile.count === 0) {
      continue;
    }
    count += profile.count;
    max = Math.max(max, profile.maxResidual);
    sum += profile.sumResidual;
    inherited.push(labelOf(child));
  }

  const called = data.elements[shape.id]?.calledProcess;
  if (called?.rollup) {
    count += called.rollup.riskCount;
    max = Math.max(max, called.rollup.maxResidualScore);
    sum += called.rollup.residualScoreSum;
    inherited.push(called.name);
  }

  const origin: RiskProfile["origin"] =
    inherited.length === 0 ? "own" : own.count === 0 ? "rolled-up" : "mixed";

  return {
    count,
    maxResidual: max,
    sumResidual: sum,
    origin,
    inheritedFrom: inherited,
  };
}

/** Ampelstufe eines Restscores — dieselben Schwellen wie im Bestand. */
export function riskLevel(score: number): "low" | "medium" | "high" {
  if (score >= HIGH_RISK_SCORE) {
    return "high";
  }
  return score >= MEDIUM_RISK_SCORE ? "medium" : "low";
}

/* ------------------------------------------------------------------ *
 * F4 — Nachweisfälligkeit
 * ------------------------------------------------------------------ */

export type EvidenceStage = "fresh" | "due" | "overdue" | "never";

export interface EvidenceResult {
  readonly stage: EvidenceStage;
  /** Tage bis zur Fälligkeit; negativ = überfällig. */
  readonly daysUntilDue: number | undefined;
  /** Alter des jüngsten Nachweises in Tagen. */
  readonly ageDays: number | undefined;
  readonly controlCount: number;
  /** Kontrollen ohne jeden Nachweis. */
  readonly withoutEvidence: readonly GrcControl[];
  readonly worstControl: GrcControl | undefined;
}

/** Frist, ab der ein Nachweis als „bald fällig" gilt (§3.12/F4: 30 Tage). */
export const EVIDENCE_DUE_SOON_DAYS = 30;

/**
 * Nachweisfälligkeit über alle Kontrollen eines Schritts (F4).
 *
 * Der Schritt ist so frisch wie sein *ältester* Nachweis — die schlechteste
 * Kontrolle bestimmt die Stufe. Eine Kontrolle ohne jeden Nachweis schlägt jede
 * Fristbetrachtung: „nie" ist eine eigene Stufe und nicht bloß „sehr überfällig".
 */
export function computeEvidence(
  element: GrcElementData | undefined,
  asOf: Date,
): EvidenceResult {
  const controls = element?.controls ?? [];
  if (controls.length === 0) {
    return {
      stage: "never",
      daysUntilDue: undefined,
      ageDays: undefined,
      controlCount: 0,
      withoutEvidence: [],
      worstControl: undefined,
    };
  }

  const withoutEvidence = controls.filter(
    (control) => !control.lastEvidenceAt && !control.lastTestedAt,
  );
  if (withoutEvidence.length > 0) {
    return {
      stage: "never",
      daysUntilDue: undefined,
      ageDays: undefined,
      controlCount: controls.length,
      withoutEvidence,
      worstControl: withoutEvidence[0],
    };
  }

  let worst: GrcControl | undefined;
  let worstDue: number | undefined;
  let oldestAge: number | undefined;

  for (const control of controls) {
    const evidenceAt = control.lastEvidenceAt ?? control.lastTestedAt;
    const age =
      evidenceAt === undefined ? undefined : daysBetween(evidenceAt, asOf);
    if (age !== undefined && (oldestAge === undefined || age > oldestAge)) {
      oldestAge = age;
    }
    const due =
      control.evidenceDueAt === undefined
        ? undefined
        : -daysBetween(control.evidenceDueAt, asOf);
    if (due !== undefined && (worstDue === undefined || due < worstDue)) {
      worstDue = due;
      worst = control;
    }
  }

  let stage: EvidenceStage;
  if (worstDue === undefined) {
    // Ohne Fälligkeitsdatum entscheidet das Alter: älter als ein Jahr gilt als
    // überfällig, das entspricht dem üblichen jährlichen Kontrolltestzyklus.
    stage =
      oldestAge !== undefined && oldestAge > 365
        ? "overdue"
        : oldestAge !== undefined && oldestAge > 365 - EVIDENCE_DUE_SOON_DAYS
          ? "due"
          : "fresh";
  } else if (worstDue < 0) {
    stage = "overdue";
  } else if (worstDue <= EVIDENCE_DUE_SOON_DAYS) {
    stage = "due";
  } else {
    stage = "fresh";
  }

  return {
    stage,
    daysUntilDue: worstDue,
    ageDays: oldestAge,
    controlCount: controls.length,
    withoutEvidence: [],
    worstControl: worst ?? controls[0],
  };
}

/* ------------------------------------------------------------------ *
 * Feststellungen (A3)
 * ------------------------------------------------------------------ */

export interface FindingResult {
  readonly open: number;
  readonly overdue: number;
  readonly dueSoon: number;
  readonly critical: number;
  readonly stage: "none" | "open" | "due" | "overdue";
  readonly items: readonly GrcFinding[];
}

/** Feststellungen mit Fälligkeit statt bloßer Anzahl (§3.4/A3). */
export const FINDING_DUE_SOON_DAYS = 14;

export function computeFindings(
  element: GrcElementData | undefined,
  asOf: Date,
): FindingResult {
  const items = (element?.findings ?? []).filter(
    (finding) => finding.status !== "closed",
  );
  let overdue = 0;
  let dueSoon = 0;
  for (const finding of items) {
    if (!finding.dueAt) {
      continue;
    }
    const days = -daysBetween(finding.dueAt, asOf);
    if (days < 0) {
      overdue += 1;
    } else if (days <= FINDING_DUE_SOON_DAYS) {
      dueSoon += 1;
    }
  }
  const critical = items.filter(
    (finding) => finding.severity === "critical",
  ).length;

  const stage: FindingResult["stage"] =
    items.length === 0
      ? "none"
      : overdue > 0
        ? "overdue"
        : dueSoon > 0
          ? "due"
          : "open";

  return { open: items.length, overdue, dueSoon, critical, stage, items };
}

/* ------------------------------------------------------------------ *
 * F7/B4 — Kantenkennzahlen aus beobachteten Übergängen (OP-012)
 * ------------------------------------------------------------------ */

/**
 * [ARCTOS-FULL-2026-08-31 · OP-012] Beobachtete Übergänge, aufgelöst auf die
 * Verbindungen der Szene.
 *
 * Der Endpunkt liefert Knotenpaare, weil er keine Kantenkennungen kennt
 * (Begründung an `GrcObservedTransition`). Diese Funktion macht daraus einen
 * Record über **Kanten-IDs** — dieselbe Form, die `GrcEdgeData` hat, nur
 * gerechnet statt geliefert.
 *
 * **Der Fall, an dem eine naive Auflösung falsch wäre:** zwei Verbindungen
 * zwischen denselben beiden Knoten (im BPMN erlaubt, etwa eine Rückkopplung
 * über zwei Wege). Beiden dieselbe Häufigkeit zuzuschreiben verdoppelte die
 * Zahl im Bild; sie zu teilen wäre geraten. Deshalb: ein Paar, das auf
 * **mehr als eine** Verbindung passt, wird gar nicht zugeordnet. Es bleibt in
 * `unresolved` und kann als Geisterkante gezeichnet werden — sichtbar, aber
 * nicht falsch beziffert.
 */
export interface TransitionResolution {
  /** Kanten-ID → beobachteter Übergang. */
  readonly byEdge: ReadonlyMap<string, GrcObservedTransition>;
  /** Übergänge ohne eindeutige Verbindung im Modell. */
  readonly unresolved: readonly GrcObservedTransition[];
}

export function resolveTransitions(
  graph: GrcGraph,
  transitions: readonly GrcObservedTransition[],
): TransitionResolution {
  // Paar → alle Verbindungen, die es verbinden.
  const byPair = new Map<string, string[]>();
  for (const connection of graph.scene.connections) {
    const from = connection.source?.id;
    const to = connection.target?.id;
    if (from === undefined || to === undefined) continue;
    const key = `${from}\u0000${to}`;
    const list = byPair.get(key) ?? [];
    list.push(connection.id);
    byPair.set(key, list);
  }

  const byEdge = new Map<string, GrcObservedTransition>();
  const unresolved: GrcObservedTransition[] = [];
  for (const transition of transitions) {
    const candidates =
      byPair.get(
        `${transition.fromElementId}\u0000${transition.toElementId}`,
      ) ?? [];
    if (candidates.length === 1) {
      byEdge.set(candidates[0]!, transition);
    } else {
      unresolved.push(transition);
    }
  }
  return { byEdge, unresolved };
}

/* ------------------------------------------------------------------ *
 * F11 — Kostenverteilung je Lane
 * ------------------------------------------------------------------ */

export interface LaneCostEntry {
  readonly laneId: string;
  /** Summe über die Aktivitäten der Lane, in der Währung des Datensatzes. */
  readonly cost: number;
  /** Anteil an den Gesamtkosten des Diagramms, 0…1. */
  readonly share: number;
  /** Aktivitäten in dieser Lane mit vollständiger Kostenangabe. */
  readonly activitiesWithCost: number;
  /** Aktivitäten in dieser Lane insgesamt. */
  readonly activities: number;
}

export interface LaneCostResult {
  readonly byLane: ReadonlyMap<string, LaneCostEntry>;
  readonly total: number;
  readonly currency: string | undefined;
  /** Aktivitäten im ganzen Diagramm mit vollständiger Kostenangabe. */
  readonly withCost: number;
  /** Aktivitäten im ganzen Diagramm, die eine Kostenangabe tragen KÖNNTEN. */
  readonly activities: number;
  /** Anteil der Aktivitäten mit Kostenangabe, 0…1. */
  readonly coverage: number;
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-006] Kostenanteile je Lane (F11).
 *
 * **Die Quelle ist `simulation_activity_param`, nicht `grc_cost_entry` — und
 * das ist eine gemessene Entscheidung.** `STUFE2-A2-GRC.md` §6 nennt für den
 * Anteilsbalken `grc_cost_entry`/`grc_time_entry`. Beide Tabellen sind
 * polymorph (`entity_type`, `entity_id`) und werden im ganzen Produkt von
 * keinem Pfad mit `entity_type = 'process_step'` beschrieben; in der
 * gemigrierten und geseedeten Datenbank stehen null Zeilen. Ein Layer über
 * einer Tabelle, die niemand füllt, ist ein Layer, der immer schweigt — die
 * teuerste Form von „gebaut". `simulation_activity_param` dagegen trägt die
 * Angabe, und der Gutter zeigt sie bereits: der Balken kann dem Gutter
 * darunter damit nicht widersprechen.
 *
 * **Warum beide Angaben nötig sind.** Eine Aktivität zählt nur, wenn sie
 * `costPerExecution` **und** `executions` trägt. Fehlt die zweite, wäre die
 * Summe eine Mischung aus Kosten je Durchlauf und Gesamtkosten — zwei
 * verschiedene Größen unter einem Namen. `executions = 1` zu unterstellen wäre
 * dieselbe Erfindung, nur unauffälliger.
 *
 * **`coverage` ist Pflichtangabe, kein Beiwerk.** Ein Anteilsbalken über
 * Aktivitäten, von denen die Hälfte keine Kosten führt, sagt „34 % der
 * bekannten Kosten" und nicht „34 % der Kosten". Wer das nicht dazusagt,
 * erzeugt genau die Zahl, die dieser Audit an anderer Stelle beanstandet.
 */
export function computeLaneCosts(
  graph: GrcGraph,
  data: GrcOverlayData,
  laneOfShape: (id: string) => string | undefined,
): LaneCostResult {
  const byLane = new Map<
    string,
    { cost: number; withCost: number; activities: number }
  >();
  let total = 0;
  let withCost = 0;
  let activities = 0;
  let currency: string | undefined;

  for (const shape of graph.shapes.values()) {
    // Nur Aktivitäten: Ereignisse und Gateways tragen keine Kosten, und ein
    // Rahmen wäre die Summe seiner Kinder — doppelt gezählt.
    if (!isCostBearing(shape.type)) continue;
    const laneId = laneOfShape(shape.id);
    activities += 1;
    const bucket = byLane.get(laneId ?? "") ?? {
      cost: 0,
      withCost: 0,
      activities: 0,
    };
    bucket.activities += 1;

    const simulation = data.elements[shape.id]?.simulation;
    const perExecution = simulation?.costPerExecution;
    const executions = simulation?.executions;
    if (typeof perExecution === "number" && typeof executions === "number") {
      const cost = perExecution * executions;
      bucket.cost += cost;
      bucket.withCost += 1;
      total += cost;
      withCost += 1;
      currency ??= simulation?.currency;
    }
    if (laneId !== undefined) byLane.set(laneId, bucket);
  }

  const entries = new Map<string, LaneCostEntry>();
  for (const [laneId, bucket] of byLane) {
    entries.set(laneId, {
      laneId,
      cost: bucket.cost,
      // Ohne Gesamtsumme keine Quote. `0/0` ist kein Nullanteil.
      share: total > 0 ? bucket.cost / total : 0,
      activitiesWithCost: bucket.withCost,
      activities: bucket.activities,
    });
  }

  return {
    byLane: entries,
    total,
    currency,
    withCost,
    activities,
    coverage: activities === 0 ? 0 : withCost / activities,
  };
}

const COST_BEARING = new Set([
  "bpmn:Task",
  "bpmn:UserTask",
  "bpmn:ServiceTask",
  "bpmn:SendTask",
  "bpmn:ReceiveTask",
  "bpmn:ManualTask",
  "bpmn:ScriptTask",
  "bpmn:BusinessRuleTask",
  "bpmn:SubProcess",
  "bpmn:Transaction",
  "bpmn:AdHocSubProcess",
  "bpmn:CallActivity",
]);

function isCostBearing(type: string): boolean {
  return COST_BEARING.has(type);
}

/* ------------------------------------------------------------------ *
 * F14 — Vorfälle am Schritt
 * ------------------------------------------------------------------ */

export interface IncidentResult {
  /** Laufende Vorfälle. */
  readonly open: number;
  /** Vorfälle insgesamt, auch die abgeschlossenen. */
  readonly total: number;
  /** Schwerster laufender Vorfall; ohne laufende der schwerste überhaupt. */
  readonly worst: GrcIncident | undefined;
  readonly dataBreaches: number;
  readonly stage: "none" | "closed" | "open" | "critical";
  readonly items: readonly GrcIncident[];
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-004] Vorfälle an einem Schritt (F14).
 *
 * **Die eine Entscheidung, die diese Funktion trifft: ein abgeschlossener
 * Vorfall verschwindet nicht.** Er wechselt die Stufe (`closed`) und bleibt
 * sichtbar. Ein Prüfer, der wissen will, wo in diesem Prozess in den letzten
 * Monaten etwas passiert ist, bekommt sonst genau an den Schritten nichts
 * angezeigt, an denen aufgeräumt wurde — und der aufgeräumte Schritt sähe aus
 * wie der nie betroffene. Die Stufe unterscheidet beides, die Farbe auch.
 *
 * Die zweite Entscheidung ist die Rangfolge: ein einzelner **laufender**
 * kritischer Vorfall schlägt fünf abgeschlossene. `worst` liest deshalb zuerst
 * unter den laufenden.
 */
export function computeIncidents(
  element: GrcElementData | undefined,
): IncidentResult {
  const items = element?.incidents ?? [];
  if (items.length === 0) {
    return {
      open: 0,
      total: 0,
      worst: undefined,
      dataBreaches: 0,
      stage: "none",
      items: [],
    };
  }
  const open = items.filter((incident) => incident.isOpen);
  const rank = (incident: GrcIncident): number =>
    SEVERITY_RANK[incident.severity];
  const worstOf = (list: readonly GrcIncident[]): GrcIncident | undefined =>
    list.length === 0
      ? undefined
      : [...list].sort(
          (a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id),
        )[0];
  const worst = worstOf(open) ?? worstOf(items);
  const dataBreaches = items.filter(
    (incident) => incident.isDataBreach === true,
  ).length;

  const stage: IncidentResult["stage"] =
    open.length === 0
      ? "closed"
      : worst !== undefined && rank(worst) >= SEVERITY_RANK.high
        ? "critical"
        : "open";

  return {
    open: open.length,
    total: items.length,
    worst,
    dataBreaches,
    stage,
    items,
  };
}

const SEVERITY_RANK: Readonly<Record<GrcFinding["severity"], number>> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/* ------------------------------------------------------------------ *
 * F15 — KRI-Schwellenampel
 * ------------------------------------------------------------------ */

/**
 * Erwartungsabstand je Messtakt, in Tagen.
 *
 * `quarterly` = 91 statt 90: ein Quartal ist im Mittel 91,3 Tage, und eine zu
 * knapp gesetzte Erwartung meldet jede pünktliche Messung als verspätet.
 */
const KRI_INTERVAL_DAYS: Readonly<
  Record<NonNullable<GrcKri["frequency"]>, number>
> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  quarterly: 91,
};

/**
 * Ab dem Wievielfachen des Messtakts eine Messung als veraltet gilt.
 *
 * **Zwei, nicht eins — und das ist eine Festlegung, keine Vorsicht.** Ein
 * verpasster Takt ist Betriebsrauschen: der Messtermin fällt auf einen
 * Feiertag, der Import läuft einen Tag später. Zwei verpasste Takte sind eine
 * Lücke, und ab da behauptet die Ampel etwas über einen Zeitraum, den sie
 * nicht gesehen hat. Der Faktor steht hier einmal und wird mitgeteilt
 * (`describe`), damit ein Prüfer die Regel nachrechnen kann, statt sie zu
 * erraten.
 */
export const KRI_STALE_FACTOR = 2;

export interface KriResult {
  readonly stage: "none" | "ok" | "unset" | "stale" | "warn" | "critical";
  /** Der Indikator, der die Stufe bestimmt. */
  readonly worst: GrcKri | undefined;
  readonly red: number;
  readonly yellow: number;
  /** Indikatoren ohne vollständige Schwellen — Ampel ohne Bedeutung. */
  readonly withoutThresholds: number;
  /** Indikatoren, deren letzte Messung zu alt ist. */
  readonly stale: number;
  /** Indikatoren ganz ohne Messung. */
  readonly neverMeasured: number;
  readonly items: readonly GrcKri[];
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-008] Die Schwellenampel eines Schritts (F15).
 *
 * **Die Rangfolge ist die fachliche Aussage dieser Funktion**, und sie ist
 * nicht die naheliegende. Rot schlägt alles — aber ein **veralteter** oder
 * schwellenloser Indikator schlägt Gelb und Grün. Der Grund: „gelb" ist eine
 * Auskunft, „ich weiß es seit acht Monaten nicht" ist ein Befund über das
 * Kontrollsystem selbst, und der wiegt schwerer als ein Indikator im
 * Toleranzband. Ein grüner Punkt an einem Schritt, dessen Indikator seit
 * einem Jahr niemand gemessen hat, ist die gefährlichste Anzeige dieser
 * ganzen Schicht.
 *
 * Ein Indikator ohne Ampel wird **nicht** grün: `alert` fehlt genau dann,
 * wenn die Schwellen unvollständig sind (Begründung am Typ).
 */
export function computeKri(
  element: GrcElementData | undefined,
  asOf: Date,
): KriResult {
  const items = element?.kris ?? [];
  if (items.length === 0) {
    return {
      stage: "none",
      worst: undefined,
      red: 0,
      yellow: 0,
      withoutThresholds: 0,
      stale: 0,
      neverMeasured: 0,
      items: [],
    };
  }

  let red = 0;
  let yellow = 0;
  let withoutThresholds = 0;
  let stale = 0;
  let neverMeasured = 0;
  let worstRed: GrcKri | undefined;
  let worstStale: GrcKri | undefined;
  let worstYellow: GrcKri | undefined;

  for (const kri of items) {
    if (kri.measuredAt === undefined) {
      neverMeasured += 1;
      worstStale ??= kri;
    } else if (isKriStale(kri, asOf)) {
      stale += 1;
      worstStale ??= kri;
    }
    if (kri.alert === undefined) {
      withoutThresholds += 1;
      worstStale ??= kri;
      continue;
    }
    if (kri.alert === "red") {
      red += 1;
      worstRed ??= kri;
    } else if (kri.alert === "yellow") {
      yellow += 1;
      worstYellow ??= kri;
    }
  }

  const unklar = withoutThresholds + stale + neverMeasured;
  const stage: KriResult["stage"] =
    red > 0
      ? "critical"
      : unklar > 0
        ? withoutThresholds > 0 && stale + neverMeasured === 0
          ? "unset"
          : "stale"
        : yellow > 0
          ? "warn"
          : "ok";

  return {
    stage,
    worst: worstRed ?? worstStale ?? worstYellow ?? items[0],
    red,
    yellow,
    withoutThresholds,
    stale,
    neverMeasured,
    items,
  };
}

/** Ist die letzte Messung älter als {@link KRI_STALE_FACTOR} Messtakte? */
export function isKriStale(kri: GrcKri, asOf: Date): boolean {
  if (kri.measuredAt === undefined) return true;
  // Ohne bekannten Messtakt lässt sich „zu alt" nicht sagen. Eine Vorgabe zu
  // wählen hieße, eine Erwartung zu erfinden, die niemand vereinbart hat.
  if (kri.frequency === undefined) return false;
  // `daysBetween` zählt vom Zeitpunkt bis `asOf`, ist für eine vergangene
  // Messung also positiv — das ist genau das Alter.
  const age = daysBetween(kri.measuredAt, asOf);
  // Ein unlesbares Datum ist kein Stand. Es als frisch zu werten wäre die
  // Entwarnung, die diese Funktion nicht geben darf.
  if (!Number.isFinite(age)) return true;
  return age > KRI_INTERVAL_DAYS[kri.frequency] * KRI_STALE_FACTOR;
}

/* ------------------------------------------------------------------ *
 * F16 — Offene Maßnahmen mit Fälligkeit
 * ------------------------------------------------------------------ */

export interface WorkItemResult {
  readonly open: number;
  readonly overdue: number;
  readonly dueSoon: number;
  /** Offene Maßnahmen ganz ohne Frist. */
  readonly withoutDueDate: number;
  /** Tage bis zur nächsten Frist; negativ = überfällig. */
  readonly daysUntilDue: number | undefined;
  readonly stage: "none" | "open" | "due" | "overdue";
  readonly items: readonly GrcWorkItem[];
}

/** Dieselbe Vorwarnzeit wie bei Feststellungen — eine Frist ist eine Frist. */
export const WORK_ITEM_DUE_SOON_DAYS = FINDING_DUE_SOON_DAYS;

/**
 * [ARCTOS-FULL-2026-08-31 · OP-005] Offene Maßnahmen an einem Schritt (F16).
 *
 * **`withoutDueDate` ist der eigentliche Grund dieser Funktion.** Eine offene
 * Maßnahme ohne Frist ist in einem Prüfungswerkzeug kein neutraler Fall: sie
 * taucht in keiner Fälligkeitsliste auf, wird von keiner Erinnerung getroffen
 * und sieht in jeder Ampel grün aus. Sie deshalb aus der Rechnung zu lassen
 * wäre bequem und falsch; sie als „fällig" zu zählen wäre eine erfundene
 * Frist. Sie wird gezählt und genannt.
 *
 * Welche Zustände als offen gelten, entscheidet der Endpunkt: hier kommen nur
 * noch die offenen an. Die Zeichenschicht prüft keine Statuszeichenketten.
 */
export function computeWorkItems(
  element: GrcElementData | undefined,
  asOf: Date,
): WorkItemResult {
  const items = element?.workItems ?? [];
  if (items.length === 0) {
    return {
      open: 0,
      overdue: 0,
      dueSoon: 0,
      withoutDueDate: 0,
      daysUntilDue: undefined,
      stage: "none",
      items: [],
    };
  }
  let overdue = 0;
  let dueSoon = 0;
  let withoutDueDate = 0;
  let soonest: number | undefined;
  for (const item of items) {
    if (!item.dueAt) {
      withoutDueDate += 1;
      continue;
    }
    const days = -daysBetween(item.dueAt, asOf);
    if (!Number.isFinite(days)) {
      // Ein unlesbares Datum ist keine Frist. Es als „heute fällig" zu werten
      // wäre eine erfundene Zahl — es zählt wie eine fehlende Frist.
      withoutDueDate += 1;
      continue;
    }
    if (soonest === undefined || days < soonest) soonest = days;
    if (days < 0) {
      overdue += 1;
    } else if (days <= WORK_ITEM_DUE_SOON_DAYS) {
      dueSoon += 1;
    }
  }

  const stage: WorkItemResult["stage"] =
    overdue > 0 ? "overdue" : dueSoon > 0 ? "due" : "open";

  return {
    open: items.length,
    overdue,
    dueSoon,
    withoutDueDate,
    daysUntilDue: soonest,
    stage,
    items,
  };
}

/* ------------------------------------------------------------------ *
 * F10 — Aufbewahrung und Löschung
 * ------------------------------------------------------------------ */

export type RetentionStage = "none" | "short" | "standard" | "long";

export interface RetentionResult {
  readonly stage: RetentionStage;
  readonly months: number | undefined;
  readonly basis: string | undefined;
  readonly specialCategory: boolean;
  readonly categories: readonly string[];
}

/** Schwelle des Filters „Löschfrist < 12 Monate" aus §3.12/F10. */
export const SHORT_RETENTION_MONTHS = 12;

export function computeRetention(ropa: GrcRopa | undefined): RetentionResult {
  const categories = (ropa?.dataCategories ?? []).map(
    (category) => category.title,
  );
  const specialCategory = (ropa?.dataCategories ?? []).some(
    (category) => category.isSpecialCategory === true,
  );
  const months = ropa?.retentionMonths;

  let stage: RetentionStage = "none";
  if (months !== undefined) {
    stage =
      months < SHORT_RETENTION_MONTHS
        ? "short"
        : months <= 120
          ? "standard"
          : "long";
  }

  return {
    stage,
    months,
    basis: ropa?.retentionBasis,
    specialCategory,
    categories,
  };
}

/** Personenbezugsstufe für die Formkodierung der Sicht „Datenschutz". */
export type PersonalDataStage = "none" | "personal" | "special";

export function personalDataStage(
  ropa: GrcRopa | undefined,
): PersonalDataStage {
  if (!ropa?.isProcessingActivity) {
    return "none";
  }
  return (ropa.dataCategories ?? []).some(
    (category) => category.isSpecialCategory === true,
  )
    ? "special"
    : "personal";
}

/* ------------------------------------------------------------------ *
 * F7 — Conformance
 * ------------------------------------------------------------------ */

export interface ConformanceGate {
  /** Darf die Heatmap gezeichnet werden? */
  readonly available: boolean;
  readonly coverageRatio: number | undefined;
  readonly unmappedCount: number;
  /** Der Satz, der bei aktiver Heatmap *immer* mit angezeigt wird. */
  readonly note: string;
}

/**
 * Torwächter für die Conformance-Heatmap (§3.8).
 *
 * Ohne ausgewiesene Abdeckungsquote wird die Funktion **nicht** ausgeliefert.
 * `process_event.activity` ist ein Name, keine BPMN-ID; ohne die Zuordnung aus
 * `process_event_activity_map` wäre die Heatmap stumm falsch — und das ist
 * schlimmer als keine Heatmap.
 */
export function conformanceGate(data: GrcOverlayData): ConformanceGate {
  const summary = data.diagram?.conformance;
  const ratio = summary?.coverageRatio;
  const unmapped = summary?.unmappedActivities ?? [];

  if (ratio === undefined) {
    return {
      available: false,
      coverageRatio: undefined,
      unmappedCount: unmapped.length,
      note: "Conformance-Heatmap nicht verfügbar: die Abdeckungsquote der Aktivitätszuordnung fehlt.",
    };
  }

  const percent = Math.round(ratio * 100);
  const unmappedNote =
    unmapped.length > 0
      ? ` ${String(unmapped.length)} ${
          unmapped.length === 1 ? "Aktivität ist" : "Aktivitäten sind"
        } nicht zugeordnet: ${unmapped.join(", ")}.`
      : "";
  return {
    available: true,
    coverageRatio: ratio,
    unmappedCount: unmapped.length,
    note: `Heatmap basiert auf ${String(percent)} % der Ereignisse.${unmappedNote}`,
  };
}

/* ------------------------------------------------------------------ *
 * F8 — Framework-Abdeckung
 * ------------------------------------------------------------------ */

export interface FrameworkElementResult {
  readonly relevant: readonly GrcFrameworkMapping[];
  readonly covered: number;
  readonly partial: number;
  readonly gaps: number;
  readonly stage: "none" | "covered" | "partial" | "gap";
}

export function computeFrameworkElement(
  element: GrcElementData | undefined,
  selection: GrcFrameworkSelection | undefined,
): FrameworkElementResult {
  const all = element?.frameworks ?? [];
  const relevant = selection
    ? all.filter(
        (mapping) =>
          mapping.frameworkId === selection.frameworkId &&
          (selection.requirementRefs === undefined ||
            selection.requirementRefs.length === 0 ||
            selection.requirementRefs.some((ref) =>
              mapping.requirementRef.startsWith(ref),
            )),
      )
    : all;

  const covered = relevant.filter((m) => m.coverage === "covered").length;
  const partial = relevant.filter((m) => m.coverage === "partial").length;
  const gaps = relevant.filter((m) => m.coverage === "gap").length;

  const stage: FrameworkElementResult["stage"] =
    relevant.length === 0
      ? "none"
      : gaps > 0
        ? "gap"
        : partial > 0
          ? "partial"
          : "covered";

  return { relevant, covered, partial, gaps, stage };
}

export interface FrameworkSummary {
  readonly frameworkName: string;
  readonly requirements: number;
  readonly covered: number;
  readonly partial: number;
  readonly gaps: number;
  /** Anteil vollständig abgedeckter Anforderungen, 0…1. */
  readonly coverageRatio: number;
  readonly gapRequirements: readonly string[];
}

/**
 * Abdeckungsgrad des gewählten Rahmenwerks über das ganze Diagramm (F8).
 *
 * Gezählt wird je **Anforderung**, nicht je Verknüpfung: eine Anforderung, die
 * an fünf Schritten hängt, ist eine Anforderung. Sie gilt als abgedeckt, wenn
 * mindestens eine Verknüpfung `covered` meldet und keine `gap` — sonst würde
 * eine Lücke von vier erfüllten Nachbarn zugedeckt.
 */
export function summarizeFramework(
  data: GrcOverlayData,
  selection: GrcFrameworkSelection | undefined,
): FrameworkSummary | undefined {
  if (!selection) {
    return undefined;
  }
  const byRequirement = new Map<string, Set<GrcFrameworkMapping["coverage"]>>();
  for (const element of Object.values(data.elements)) {
    const result = computeFrameworkElement(element, selection);
    for (const mapping of result.relevant) {
      const set = byRequirement.get(mapping.requirementRef) ?? new Set();
      set.add(mapping.coverage);
      byRequirement.set(mapping.requirementRef, set);
    }
  }

  let covered = 0;
  let partial = 0;
  let gaps = 0;
  const gapRequirements: string[] = [];
  for (const [ref, states] of [...byRequirement.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (states.has("gap")) {
      gaps += 1;
      gapRequirements.push(ref);
    } else if (states.has("partial")) {
      partial += 1;
    } else {
      covered += 1;
    }
  }

  const requirements = byRequirement.size;
  return {
    frameworkName: selection.frameworkName ?? selection.frameworkId,
    requirements,
    covered,
    partial,
    gaps,
    coverageRatio: requirements === 0 ? 0 : covered / requirements,
    gapRequirements,
  };
}

/* ------------------------------------------------------------------ *
 * Hilfen
 * ------------------------------------------------------------------ */

/** Ganze Tage zwischen einem ISO-Zeitpunkt und dem Bezugszeitpunkt. */
export function daysBetween(iso: string, asOf: Date): number {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) {
    return Number.NaN;
  }
  return Math.floor((asOf.getTime() - then) / 86_400_000);
}

/** Bezugszeitpunkt aller Fristen: `diagram.asOf`, sonst `computedAt`. */
export function asOfDate(data: GrcOverlayData): Date {
  const raw = data.diagram?.asOf ?? data.computedAt;
  const parsed = Date.parse(raw);
  return new Date(Number.isFinite(parsed) ? parsed : 0);
}

function labelOf(shape: BpmnShape): string {
  const name = shape.businessObject.name;
  return typeof name === "string" && name !== "" ? name : shape.id;
}
