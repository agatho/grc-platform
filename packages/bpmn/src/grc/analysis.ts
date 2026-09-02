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
  GrcOverlayData,
  GrcRisk,
  GrcRopa,
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
